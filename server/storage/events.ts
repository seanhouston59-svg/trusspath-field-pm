import { projects, projectEvents } from '@shared/schema';
import type { ProjectEvent, InsertProjectEvent } from '@shared/schema';
import { db } from "./db";
import { sql } from "./db";
import { ensureReady } from "./ready";

export class EventsRepo {
  async recordEvent(data: Partial<InsertProjectEvent> & {
    projectId: number;
    kind: string;
    title: string;
  }): Promise<void> {
    try {
      await ensureReady();
      await db.insert(projectEvents).values({
        projectId: data.projectId,
        organizationId: data.organizationId ?? null,
        actorAccountId: data.actorAccountId ?? null,
        actorName: data.actorName ?? null,
        kind: data.kind,
        title: data.title,
        subtitle: data.subtitle ?? null,
        meta: (data.meta ?? {}) as any,
        sourceType: data.sourceType ?? null,
        sourceId: data.sourceId ?? null,
        occurredAt: data.occurredAt ?? new Date().toISOString(),
      } as any);
    } catch (err) {
      // Non-fatal — timeline is a nice-to-have, not the source of truth.
      // eslint-disable-next-line no-console
      console.error("[recordEvent] failed:", err);
    }
  }

  /**
   * Read the timeline for one project with optional filters. Server-side
   * pagination + kind filter + full-text-ish search over title/subtitle so
   * large projects (thousands of events) stay quick.
   */

  async getProjectEvents(
    projectId: number,
    opts: {
      q?: string;
      kinds?: string[];  // filter to just these kinds
      limit?: number;
      before?: string;   // ISO — for pagination (return events older than this)
    } = {},
  ): Promise<ProjectEvent[]> {
    await ensureReady();
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    // Use tagged-template SQL directly so we can compose LIKE + IN cleanly.
    // Drizzle's builder gets awkward with dynamic IN lists over jsonb.
    const kindClause = opts.kinds && opts.kinds.length > 0
      ? sql`AND kind = ANY(${opts.kinds})`
      : sql``;
    const beforeClause = opts.before
      ? sql`AND occurred_at < ${opts.before}`
      : sql``;
    const searchClause = opts.q && opts.q.trim().length > 0
      ? (() => {
          const like = `%${opts.q!.trim().toLowerCase()}%`;
          return sql`AND (LOWER(title) LIKE ${like} OR LOWER(COALESCE(subtitle, '')) LIKE ${like} OR LOWER(COALESCE(actor_name, '')) LIKE ${like})`;
        })()
      : sql``;
    const rows: any[] = await sql`
      SELECT id, organization_id, project_id, actor_account_id, actor_name, kind,
             title, subtitle, meta, source_type, source_id, occurred_at, created_at
      FROM project_events
      WHERE project_id = ${projectId}
      ${kindClause}
      ${beforeClause}
      ${searchClause}
      ORDER BY occurred_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id,
      actorAccountId: r.actor_account_id,
      actorName: r.actor_name,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      meta: r.meta ?? {},
      sourceType: r.source_type,
      sourceId: r.source_id,
      occurredAt: typeof r.occurred_at === "string" ? r.occurred_at : new Date(r.occurred_at).toISOString(),
      createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
    })) as ProjectEvent[];
  }

  /** Kind counts for one project — used by the filter chips to show badges. */

  async getProjectEventKindCounts(projectId: number): Promise<Record<string, number>> {
    await ensureReady();
    const rows: any[] = await sql`
      SELECT kind, COUNT(*)::int AS c
      FROM project_events
      WHERE project_id = ${projectId}
      GROUP BY kind
    `;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.kind] = r.c;
    return out;
  }

  /* ----------------------------- Timesheets ---------------------------- */
}
