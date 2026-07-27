// SMS sender for urgent field alerts. Uses Twilio's Messaging API over HTTPS
// (no SDK — Twilio's REST API is a simple form POST with basic auth).
//
// Configure via Vercel env:
//   TWILIO_ACCOUNT_SID    required (starts with "AC...")
//   TWILIO_AUTH_TOKEN     required
//   TWILIO_FROM_NUMBER    required, E.164, e.g. "+15555550123"
//   SMS_DRY_RUN           optional — "true" logs the send without hitting Twilio
//
// If any of the three required vars is missing, sends are skipped and logged
// as "dry_run" in sms_log so the app still works end-to-end while we wait
// for Twilio to be provisioned.

import { db } from "./storage";
import { accounts, smsLog } from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const HOURLY_LIMIT_PER_ACCOUNT = 10;
const DEDUPE_WINDOW_HOURS = 24;

export type SmsSendResult = {
  ok: boolean;
  status: "sent" | "dry_run" | "rate_limited" | "opted_out" | "no_phone" | "unverified" | "duplicate" | "failed";
  providerSid?: string;
  error?: string;
};

// Twilio-safe E.164 check. We normalize by stripping spaces/dashes/parens but
// require the caller to include the +country prefix so we never guess.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s\-().]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) return null;
  return cleaned;
}

function isConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

// Send SMS to a specific account by id. Handles opt-in check, rate limit,
// per-event dedupe, and logs every attempt.
export async function sendSmsToAccount(input: {
  accountId: number;
  organizationId?: number | null;
  eventKey: string;
  body: string;
}): Promise<SmsSendResult> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, input.accountId));
  if (!account) return { ok: false, status: "failed", error: "account_not_found" };

  const phone = normalizePhone(account.smsPhone);
  if (!phone) {
    await logSms({ ...input, toPhone: "", status: "no_phone" });
    return { ok: false, status: "no_phone" };
  }
  if (!account.smsVerifiedAt) {
    await logSms({ ...input, toPhone: phone, status: "unverified" });
    return { ok: false, status: "unverified" };
  }
  if (account.smsOptedOutAt) {
    await logSms({ ...input, toPhone: phone, status: "opted_out" });
    return { ok: false, status: "opted_out" };
  }

  // Rate limit: at most N sends per account per hour.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(smsLog)
    .where(and(eq(smsLog.accountId, input.accountId), gte(smsLog.createdAt, hourAgo), eq(smsLog.status, "sent")));
  const hourCount = Number(recent[0]?.count ?? 0);
  if (hourCount >= HOURLY_LIMIT_PER_ACCOUNT) {
    await logSms({ ...input, toPhone: phone, status: "rate_limited" });
    return { ok: false, status: "rate_limited" };
  }

  // Dedupe: same event key already delivered to this account in last 24h?
  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const dupe = await db
    .select({ id: smsLog.id })
    .from(smsLog)
    .where(
      and(
        eq(smsLog.accountId, input.accountId),
        eq(smsLog.eventKey, input.eventKey),
        eq(smsLog.status, "sent"),
        gte(smsLog.createdAt, dedupeSince),
      ),
    )
    .limit(1);
  if (dupe[0]) {
    await logSms({ ...input, toPhone: phone, status: "duplicate" });
    return { ok: false, status: "duplicate" };
  }

  // Actually send.
  if (!isConfigured() || process.env.SMS_DRY_RUN === "true") {
    console.log(`[sms] dry_run to=${phone} event=${input.eventKey} body="${input.body}"`);
    await logSms({ ...input, toPhone: phone, status: "dry_run" });
    return { ok: true, status: "dry_run" };
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fromNumber = process.env.TWILIO_FROM_NUMBER!;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams({ To: phone, From: fromNumber, Body: input.body });
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      await logSms({ ...input, toPhone: phone, status: "failed", error: `twilio ${resp.status}: ${text.slice(0, 200)}` });
      console.error(`[sms] twilio ${resp.status}: ${text}`);
      return { ok: false, status: "failed", error: `twilio ${resp.status}` };
    }
    const data = (await resp.json().catch(() => ({}))) as { sid?: string };
    await logSms({ ...input, toPhone: phone, status: "sent", providerSid: data.sid });
    return { ok: true, status: "sent", providerSid: data.sid };
  } catch (err: any) {
    await logSms({ ...input, toPhone: phone, status: "failed", error: String(err?.message || err) });
    return { ok: false, status: "failed", error: String(err?.message || err) };
  }
}

async function logSms(row: {
  accountId: number;
  organizationId?: number | null;
  eventKey: string;
  toPhone: string;
  body: string;
  status: string;
  providerSid?: string;
  error?: string;
}) {
  try {
    await db.insert(smsLog).values({
      accountId: row.accountId,
      organizationId: row.organizationId ?? null,
      eventKey: row.eventKey,
      toPhone: row.toPhone,
      body: row.body,
      status: row.status,
      providerSid: row.providerSid ?? null,
      error: row.error ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[sms] failed to write sms_log:", err);
  }
}

// Send a raw one-off SMS (used for verification OTP - no dedupe, no eventKey).
export async function sendRawSms(toPhone: string, body: string): Promise<SmsSendResult> {
  const phone = normalizePhone(toPhone);
  if (!phone) return { ok: false, status: "no_phone", error: "invalid_phone" };
  if (!isConfigured() || process.env.SMS_DRY_RUN === "true") {
    console.log(`[sms] dry_run raw to=${phone} body="${body}"`);
    return { ok: true, status: "dry_run" };
  }
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fromNumber = process.env.TWILIO_FROM_NUMBER!;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams({ To: phone, From: fromNumber, Body: body });
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(`[sms] verify twilio ${resp.status}: ${text}`);
      return { ok: false, status: "failed", error: `twilio ${resp.status}` };
    }
    const data = (await resp.json().catch(() => ({}))) as { sid?: string };
    return { ok: true, status: "sent", providerSid: data.sid };
  } catch (err: any) {
    return { ok: false, status: "failed", error: String(err?.message || err) };
  }
}
