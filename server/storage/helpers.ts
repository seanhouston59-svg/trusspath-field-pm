import type { Project, TeamMember } from '@shared/schema';
import { SIGNER_ROLE_ALIASES } from '@shared/mobilization-catalog';

/** Best-effort roster lookup for a sign-off role. Substring match in both
 *  directions so a team member listed as "PM" or "Senior Project Manager"
 *  both resolve. Returns null when nothing matches — the row still gets
 *  created, just without a pre-filled name. */
export function matchSignerName(
  roster: TeamMember[],
  role: string,
  aliasTable: Record<string, string[]> = SIGNER_ROLE_ALIASES,
): string | null {
  const aliases = aliasTable[role] ?? [role.toLowerCase()];
  const hit = roster.find((m) => {
    const r = (m.role ?? "").trim().toLowerCase();
    if (!r) return false;
    return aliases.some((a) => r === a || r.includes(a) || a.includes(r));
  });
  return hit?.name ?? null;
}
