// Notification fanout for urgent field alerts (SMS-first, extensible later).
//
// Given a project + an event key + a message, look up all org members whose
// role can receive urgent field alerts (owner/admin/pm/foreman) and fan out
// via the SMS sender. Every attempt is logged; per-account rate-limit + dedupe
// live inside sendSmsToAccount.

import { db } from "./storage";
import { memberships, projects } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { sendSmsToAccount } from "./sms";

export type UrgentAlertRoles = "owner" | "admin" | "pm" | "foreman";
const DEFAULT_ROLES: UrgentAlertRoles[] = ["owner", "admin", "pm", "foreman"];

export type BroadcastResult = {
  totalTargets: number;
  sent: number;
  skipped: Record<string, number>;
};

// Fan out an urgent alert to every eligible member of an org (and optionally
// scoped to a project - filtering by project happens in the caller via
// projectMembers if needed; the default here is "everyone in the org whose
// role can receive it"). exceptAccountId lets you skip the account that
// triggered the event so they don't get their own alert.
export async function broadcastSmsToOrg(input: {
  organizationId: number;
  eventKey: string;
  body: string;
  roles?: UrgentAlertRoles[];
  exceptAccountId?: number;
}): Promise<BroadcastResult> {
  const roles = input.roles ?? DEFAULT_ROLES;
  const rows = await db
    .select({ accountId: memberships.accountId, role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(memberships.status, "active"),
        inArray(memberships.role, roles as string[]),
      ),
    );
  const targets = input.exceptAccountId
    ? rows.filter((r) => r.accountId !== input.exceptAccountId)
    : rows;

  const skipped: Record<string, number> = {};
  let sent = 0;
  for (const t of targets) {
    const r = await sendSmsToAccount({
      accountId: t.accountId,
      organizationId: input.organizationId,
      eventKey: input.eventKey,
      body: input.body,
    });
    if (r.status === "sent") sent++;
    else skipped[r.status] = (skipped[r.status] ?? 0) + 1;
  }
  return { totalTargets: targets.length, sent, skipped };
}

// Same but scoped to a specific project - looks up which org it belongs to.
// Callers pass a projectId (not orgId) because urgent alerts are naturally
// project-scoped in the field.
export async function broadcastSmsToProject(input: {
  projectId: number;
  eventKey: string;
  body: string;
  roles?: UrgentAlertRoles[];
  exceptAccountId?: number;
}): Promise<BroadcastResult & { organizationId: number | null }> {
  const [proj] = await db.select({ orgId: projects.organizationId }).from(projects).where(eq(projects.id, input.projectId));
  if (!proj?.orgId) {
    return { totalTargets: 0, sent: 0, skipped: { no_org: 1 }, organizationId: null };
  }
  const r = await broadcastSmsToOrg({
    organizationId: proj.orgId,
    eventKey: input.eventKey,
    body: input.body,
    roles: input.roles,
    exceptAccountId: input.exceptAccountId,
  });
  return { ...r, organizationId: proj.orgId };
}
