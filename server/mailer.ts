// Simple mailer for landing-page signup notifications.
// Uses Resend (https://resend.com/) via its HTTP API — no SDK needed.
//
// Configure by setting these env vars in Vercel (Project → Settings → Environment Variables):
//   RESEND_API_KEY      required — from https://resend.com/api-keys
//   SIGNUP_NOTIFY_TO    optional — recipient. Defaults to houston.sean90@gmail.com
//   SIGNUP_NOTIFY_FROM  optional — sender. Defaults to onboarding@resend.dev (Resend's shared sandbox sender).
//                                  Use a verified domain in production (e.g. no-reply@trusspath.app).
//
// If RESEND_API_KEY is not set, sends are skipped silently — signups still persist to the database.

const DEFAULT_TO = "houston.sean90@gmail.com";
const DEFAULT_FROM = "TrussPath <onboarding@resend.dev>";

export type SignupNotification = {
  kind: "subscriber" | "demo-request" | "signup";
  subject: string;
  fields: Record<string, string | number | undefined | null>;
  /** Optional call-to-action button rendered below the field table. */
  cta?: { label: string; url: string };
  /** Optional highlight banner shown above the field table (e.g. "Awaiting approval"). */
  banner?: { label: string; tone?: "warning" | "info" };
};

function renderHtml(n: SignupNotification): string {
  const rows = Object.entries(n.fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(
          k
        )}</td><td style="padding:6px 12px;font-size:15px;color:#111;">${escapeHtml(String(v))}</td></tr>`
    )
    .join("");
  const kindLabel = n.kind === "subscriber" ? "New TrussPath subscriber" : n.kind === "signup" ? "New TrussPath account — needs approval" : "New TrussPath demo request";
  const bannerHtml = n.banner
    ? `<div style="margin:16px 20px 0;padding:12px 14px;border-radius:8px;background:${
        n.banner.tone === "warning" ? "#fef3c7" : "#dbeafe"
      };color:${n.banner.tone === "warning" ? "#92400e" : "#1e40af"};font-size:14px;font-weight:600;">${escapeHtml(n.banner.label)}</div>`
    : "";
  const ctaHtml = n.cta
    ? `<div style="padding:8px 20px 20px;"><a href="${escapeHtml(n.cta.url)}" style="display:inline-block;padding:10px 22px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${escapeHtml(n.cta.label)}</a></div>`
    : "";
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f7f6f4;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
    <div style="padding:16px 20px;background:#111;color:#fff;font-weight:600;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(kindLabel)}</div>
    ${bannerHtml}
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows}</table>
    ${ctaHtml}
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee;">Sent by trusspath-field-pm.vercel.app</div>
  </div>
</body></html>`;
}

function renderText(n: SignupNotification): string {
  const rows = Object.entries(n.fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const bannerText = n.banner ? `${n.banner.label}\n\n` : "";
  const ctaText = n.cta ? `\n\n${n.cta.label}: ${n.cta.url}` : "";
  return `${n.subject}\n\n${bannerText}${rows}${ctaText}\n`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendSignupNotification(n: SignupNotification): Promise<{ ok: boolean; skipped?: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SIGNUP_NOTIFY_TO || DEFAULT_TO;
  const from = process.env.SIGNUP_NOTIFY_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping email for ${n.kind}. Would send to ${to}.`);
    return { ok: true, skipped: true };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: n.subject,
        html: renderHtml(n),
        text: renderText(n),
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[mailer] Resend ${resp.status}: ${body}`);
      return { ok: false, error: `Resend ${resp.status}` };
    }
    const data = (await resp.json().catch(() => ({}))) as { id?: string };
    console.log(`[mailer] Sent ${n.kind} notification to ${to} (id=${data.id ?? "?"})`);
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[mailer] Send failed:", err);
    return { ok: false, error: String(err) };
  }
}

export async function sendInviteEmail(input: {
  toEmail: string;
  orgName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SIGNUP_NOTIFY_FROM || DEFAULT_FROM;
  const { toEmail, orgName, inviterName, role, inviteUrl } = input;

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping invite to ${toEmail}. Invite URL: ${inviteUrl}`);
    return { ok: true, skipped: true };
  }

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f7f6f4;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
    <div style="padding:16px 20px;background:#111;color:#fff;font-weight:600;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">You've been invited to TrussPath</div>
    <div style="padding:24px 20px;">
      <p style="font-size:15px;color:#111;margin:0 0 16px;"><strong>${escapeHtml(inviterName)}</strong> invited you to join <strong>${escapeHtml(orgName)}</strong> on TrussPath as a <strong>${escapeHtml(role)}</strong>.</p>
      <p style="font-size:14px;color:#666;margin:0 0 24px;">Click the button below to accept the invite and set up your account. This link expires in 7 days.</p>
      <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Accept invite</a>
      <p style="font-size:13px;color:#999;margin:24px 0 0;">If you didn't expect this, you can safely ignore this email.</p>
    </div>
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee;">TrussPath — Field Project Management</div>
  </div>
</body></html>`;

  const text = `${inviterName} invited you to join ${orgName} on TrussPath as a ${role}.\n\nAccept the invite here (link expires in 7 days):\n${inviteUrl}\n\nIf you didn't expect this, you can safely ignore this email.`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: `${inviterName} invited you to ${orgName} on TrussPath`,
        html,
        text,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[mailer] Resend ${resp.status}: ${body}`);
      return { ok: false, error: `Resend ${resp.status}` };
    }
    console.log(`[mailer] Sent invite email to ${toEmail}`);
    return { ok: true };
  } catch (err) {
    console.error("[mailer] Invite send failed:", err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Notifies PMs when a sub company submits a draft RFI or Change Order via
 * the sub portal. Sends one email per recipient (Resend recommends against
 * batching addressees in a single message for transactional flows).
 * Silently no-ops when RESEND_API_KEY is unset \u2014 the URL is logged so
 * the flow still works in dev.
 *
 * All copy is intentionally plain: subs at a jobsite may draft an RFI on
 * their phone at 6am, and the PM opening the email on their phone should
 * see the number, subject, dollar amount, and jump-to link without any
 * ceremony.
 */
export async function sendSubDraftNotification(input: {
  kind: "rfi" | "change_order";
  toEmails: string[];         // PMs to notify; duplicates + empties filtered
  projectName: string;
  subCompanyName: string;
  number: string;             // e.g. "RFI-014" / "CO-003"
  title: string;              // subject (RFI) or title (CO)
  amount?: number | null;     // CO only
  scheduleImpact?: number | null; // CO only, days
  url: string;                // deep link to /rfis or /change-orders
}): Promise<{ ok: boolean; skipped?: boolean; error?: string; sent?: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SIGNUP_NOTIFY_FROM || DEFAULT_FROM;

  // Dedup + trim + strip empties. Bail early if nobody to notify.
  const seen = new Set<string>();
  const recipients = input.toEmails
    .map(e => (e || "").trim().toLowerCase())
    .filter(e => e && !seen.has(e) && (seen.add(e), true));
  if (recipients.length === 0) {
    return { ok: true, skipped: true, sent: 0 };
  }

  const label = input.kind === "rfi" ? "RFI" : "Change Order";
  const subject = `[${input.projectName}] ${input.subCompanyName} submitted a draft ${label} (${input.number})`;

  // CO-specific rows only when relevant. Amounts formatted with sign so a
  // positive change is unmistakable.
  const amountRow = input.kind === "change_order" && input.amount != null
    ? `<tr><td style="padding:6px 12px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">Amount</td><td style="padding:6px 12px;font-size:15px;color:#111;">${escapeHtml(formatAmount(input.amount))}</td></tr>`
    : "";
  const scheduleRow = input.kind === "change_order" && input.scheduleImpact != null
    ? `<tr><td style="padding:6px 12px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">Schedule</td><td style="padding:6px 12px;font-size:15px;color:#111;">${input.scheduleImpact > 0 ? "+" : ""}${input.scheduleImpact} day${Math.abs(input.scheduleImpact) === 1 ? "" : "s"}</td></tr>`
    : "";

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f7f6f4;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
    <div style="padding:16px 20px;background:#111;color:#fff;font-weight:600;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">Draft ${escapeHtml(label)} from a sub</div>
    <div style="padding:20px;">
      <p style="font-size:15px;color:#111;margin:0 0 16px;"><strong>${escapeHtml(input.subCompanyName)}</strong> submitted a draft ${escapeHtml(label.toLowerCase())} on <strong>${escapeHtml(input.projectName)}</strong>. Review and accept when you're ready.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;border:1px solid #eee;border-radius:6px;overflow:hidden;">
        <tr><td style="padding:6px 12px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">Number</td><td style="padding:6px 12px;font-size:15px;color:#111;">${escapeHtml(input.number)}</td></tr>
        <tr><td style="padding:6px 12px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">${input.kind === "rfi" ? "Subject" : "Title"}</td><td style="padding:6px 12px;font-size:15px;color:#111;">${escapeHtml(input.title)}</td></tr>
        ${amountRow}
        ${scheduleRow}
      </table>
      <a href="${escapeHtml(input.url)}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Review ${escapeHtml(label)}</a>
      <p style="font-size:13px;color:#999;margin:24px 0 0;">You're receiving this because you're on the team for ${escapeHtml(input.projectName)}.</p>
    </div>
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee;">TrussPath \u2014 Field Project Management</div>
  </div>
</body></html>`;

  const text = `${input.subCompanyName} submitted a draft ${label.toLowerCase()} on ${input.projectName}.\n\n${input.number} \u2014 ${input.title}\n${input.kind === "change_order" && input.amount != null ? `Amount: ${formatAmount(input.amount)}\n` : ""}${input.kind === "change_order" && input.scheduleImpact != null ? `Schedule: ${input.scheduleImpact > 0 ? "+" : ""}${input.scheduleImpact} day${Math.abs(input.scheduleImpact) === 1 ? "" : "s"}\n` : ""}\nReview it here:\n${input.url}`;

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set \u2014 skipping sub-draft ${label} email to ${recipients.join(", ")}. Deep link: ${input.url}`);
    return { ok: true, skipped: true, sent: 0 };
  }

  // Resend transactional flows do best with one recipient per request. We
  // fire in parallel so a slow send to one PM doesn't hold up the others.
  const results = await Promise.allSettled(recipients.map(to =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    }).then(async (resp) => {
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error(`[mailer] Resend ${resp.status} to ${to}: ${body}`);
        return false;
      }
      return true;
    }).catch((err) => { console.error(`[mailer] Send failed to ${to}:`, err); return false; })
  ));
  const sent = results.filter(r => r.status === "fulfilled" && r.value === true).length;
  console.log(`[mailer] Sent sub-draft ${label} to ${sent}/${recipients.length} PMs on ${input.projectName}`);
  return { ok: sent > 0, sent };
}

// Local, terse currency formatter. Doesn't drag in Intl for cents-precision
// because CO amounts are always whole dollars in this codebase.
function formatAmount(n: number): string {
  const sign = n >= 0 ? "+" : "\u2212";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SIGNUP_NOTIFY_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping password reset email to ${toEmail}. Reset URL: ${resetUrl}`);
    return { ok: true, skipped: true };
  }

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f7f6f4;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
    <div style="padding:16px 20px;background:#111;color:#fff;font-weight:600;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">TrussPath — Password Reset</div>
    <div style="padding:24px 20px;">
      <p style="font-size:15px;color:#111;margin:0 0 16px;">We received a request to reset your TrussPath password.</p>
      <p style="font-size:14px;color:#666;margin:0 0 24px;">Click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Reset Password</a>
      <p style="font-size:13px;color:#999;margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee;">TrussPath — Field Project Management</div>
  </div>
</body></html>`;

  const text = `TrussPath — Password Reset\n\nWe received a request to reset your TrussPath password.\n\nClick the link below to set a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: "TrussPath — Reset your password",
        html,
        text,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[mailer] Resend ${resp.status}: ${body}`);
      return { ok: false, error: `Resend ${resp.status}` };
    }
    console.log(`[mailer] Sent password reset email to ${toEmail}`);
    return { ok: true };
  } catch (err) {
    console.error("[mailer] Password reset send failed:", err);
    return { ok: false, error: String(err) };
  }
}
