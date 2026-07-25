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
  kind: "subscriber" | "demo-request";
  subject: string;
  fields: Record<string, string | number | undefined | null>;
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
  const kindLabel = n.kind === "subscriber" ? "New TrussPath subscriber" : "New TrussPath demo request";
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f7f6f4;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
    <div style="padding:16px 20px;background:#111;color:#fff;font-weight:600;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(kindLabel)}</div>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows}</table>
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee;">Sent by trusspath-field-pm.vercel.app</div>
  </div>
</body></html>`;
}

function renderText(n: SignupNotification): string {
  const rows = Object.entries(n.fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return `${n.subject}\n\n${rows}\n`;
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
