// DocuSign eSignature integration.
//
// Configure by setting these env vars (Vercel → Project → Settings → Environment Variables):
//   DOCUSIGN_BASE_URI        required — e.g. https://demo.docusign.net for sandbox,
//                                       https://na3.docusign.net (or your account's) for production
//   DOCUSIGN_ACCOUNT_ID      required — API Account ID from Apps & Keys
//   DOCUSIGN_INTEGRATION_KEY required — the integration (client) key
//   DOCUSIGN_USER_ID         required — the impersonated user's API Username (GUID)
//   DOCUSIGN_PRIVATE_KEY     required — RSA private key PEM for JWT grant. Newlines may be
//                                       written as literal "\n" in the env var.
//   DOCUSIGN_OAUTH_HOST      optional — account-d.docusign.com (default) or account.docusign.com
//   DOCUSIGN_CONNECT_HMAC_KEY optional — enables HMAC verification of Connect webhooks
//   DOCUSIGN_ACCESS_TOKEN    optional — bypass JWT grant with a pre-minted token (dev only)
//
// If the required vars are absent, isDocusignConfigured() returns false and callers
// fall back to in-app manager signing. Nothing here throws on missing config.

import { createSign, createHmac, timingSafeEqual } from "node:crypto";

export type EnvelopeResult = {
  envelopeId: string;
  status: string;
};

export type DocusignDocument = {
  /** File contents. HTML and PDF are both accepted by DocuSign. */
  content: string | Buffer;
  /** Shown in the DocuSign UI and used for the downloaded file name. */
  name: string;
  /** "html", "pdf", "txt", … */
  fileExtension: string;
};

export type EnvelopeSigner = {
  name: string;
  email: string;
  /** Text in the document the signature tab anchors to. */
  anchorString?: string;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

const REQUIRED = ["DOCUSIGN_BASE_URI", "DOCUSIGN_ACCOUNT_ID", "DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_USER_ID", "DOCUSIGN_PRIVATE_KEY"];

/** True when enough config is present to talk to the DocuSign API. */
export function isDocusignConfigured(): boolean {
  if (env("DOCUSIGN_ACCESS_TOKEN") && env("DOCUSIGN_BASE_URI") && env("DOCUSIGN_ACCOUNT_ID")) return true;
  return REQUIRED.every((k) => env(k) !== undefined);
}

/** Names of the env vars that still need to be set, for surfacing in diagnostics. */
export function missingDocusignConfig(): string[] {
  if (isDocusignConfigured()) return [];
  return REQUIRED.filter((k) => env(k) === undefined);
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cached bearer token. DocuSign JWT tokens are valid for 1 hour; refresh early. */
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const preMinted = env("DOCUSIGN_ACCESS_TOKEN");
  if (preMinted) return preMinted;

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const oauthHost = env("DOCUSIGN_OAUTH_HOST") ?? "account-d.docusign.com";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: env("DOCUSIGN_INTEGRATION_KEY"),
      sub: env("DOCUSIGN_USER_ID"),
      aud: oauthHost,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    }),
  );
  // Env vars can't hold real newlines, so accept the "\n" escaped form too.
  const privateKey = (env("DOCUSIGN_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64Url(signer.sign(privateKey));
  const assertion = `${header}.${claims}.${signature}`;

  const resp = await fetch(`https://${oauthHost}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    // consent_required means an admin must grant consent for the integration key once.
    throw new Error(`DocuSign OAuth ${resp.status}: ${body}`);
  }
  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const base = (env("DOCUSIGN_BASE_URI") ?? "").replace(/\/+$/, "");
  const accountId = env("DOCUSIGN_ACCOUNT_ID");
  const resp = await fetch(`${base}/restapi/v2.1/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  return resp;
}

/**
 * Create and send an envelope with a single signer. Returns the envelope id and
 * status. Throws if the API rejects the request — callers decide whether that is
 * fatal or should degrade to in-app signing.
 */
export async function createEnvelope(opts: {
  emailSubject: string;
  emailBlurb?: string;
  document: DocusignDocument;
  signer: EnvelopeSigner;
  /** Echoed back on Connect webhooks so we can correlate without a DB lookup. */
  metadata?: Record<string, string>;
}): Promise<EnvelopeResult> {
  const anchor = opts.signer.anchorString;
  const signHere = anchor
    ? { anchorString: anchor, anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "-6" }
    : { documentId: "1", pageNumber: "1", xPosition: "120", yPosition: "640" };

  const body = {
    emailSubject: opts.emailSubject,
    emailBlurb: opts.emailBlurb,
    status: "sent",
    documents: [
      {
        documentId: "1",
        name: opts.document.name,
        fileExtension: opts.document.fileExtension,
        documentBase64: Buffer.from(opts.document.content as any).toString("base64"),
      },
    ],
    recipients: {
      signers: [
        {
          documentId: "1",
          recipientId: "1",
          routingOrder: "1",
          name: opts.signer.name,
          email: opts.signer.email,
          tabs: { signHereTabs: [signHere] },
        },
      ],
    },
    customFields: opts.metadata
      ? {
          textCustomFields: Object.entries(opts.metadata).map(([name, value]) => ({ name, value, show: "false" })),
        }
      : undefined,
  };

  const resp = await apiFetch("/envelopes", { method: "POST", body: JSON.stringify(body) });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`DocuSign createEnvelope ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as { envelopeId: string; status: string };
  return { envelopeId: data.envelopeId, status: data.status };
}

/** Current envelope status ("sent", "delivered", "completed", "declined", "voided"). */
export async function getEnvelopeStatus(envelopeId: string): Promise<string> {
  const resp = await apiFetch(`/envelopes/${encodeURIComponent(envelopeId)}`);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`DocuSign getEnvelope ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as { status: string };
  return data.status;
}

/** The flattened, fully-signed PDF for a completed envelope. */
export async function downloadCombinedPdf(envelopeId: string): Promise<Buffer> {
  const resp = await apiFetch(`/envelopes/${encodeURIComponent(envelopeId)}/documents/combined`, {
    headers: { Accept: "application/pdf" },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`DocuSign downloadCombinedPdf ${resp.status}: ${text}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

/** Link that takes a recipient to the envelope in the DocuSign web UI. */
export function envelopeViewUrl(envelopeId: string): string {
  const base = (env("DOCUSIGN_BASE_URI") ?? "https://demo.docusign.net").replace(/\/+$/, "");
  return `${base}/Signing/StartInSession.aspx?t=${encodeURIComponent(envelopeId)}`;
}

/**
 * Verify a DocuSign Connect HMAC signature. Returns true when verification passes,
 * or when no HMAC key is configured (verification is opt-in).
 */
export function verifyConnectSignature(rawBody: string | Buffer, signatureHeader: string | undefined): boolean {
  const key = env("DOCUSIGN_CONNECT_HMAC_KEY");
  if (!key) return true;
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", key).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ConnectEvent = {
  envelopeId: string;
  status: string;
};

/**
 * Pull the envelope id and status out of a Connect webhook payload. Handles both
 * the modern JSON ("envelopeId"/"status" or nested under "data") shapes.
 */
export function parseConnectWebhook(body: unknown): ConnectEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;
  const envelopeId = b.envelopeId ?? b.data?.envelopeId ?? b.data?.envelopeSummary?.envelopeId;
  const status = b.status ?? b.event ?? b.data?.envelopeSummary?.status;
  if (!envelopeId || typeof envelopeId !== "string") return null;
  return { envelopeId, status: normalizeStatus(String(status ?? "")) };
}

/** Connect sends "envelope-completed"; the REST API sends "completed". */
export function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.startsWith("envelope-")) return s.slice("envelope-".length);
  return s;
}

export function isCompletedStatus(status: string | null | undefined): boolean {
  return normalizeStatus(String(status ?? "")) === "completed";
}
