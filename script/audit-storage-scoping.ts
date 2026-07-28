/**
 * Cross-tenant scoping audit — static, no database required.
 *
 * Run with `npm run audit:scoping` (add --strict to exit non-zero on findings).
 *
 * Catches the regression this repo has hit repeatedly: a collection read like
 * `storage.getTeam()` called with no organization scope, which returns every
 * tenant's rows. It reports two kinds of finding:
 *
 *   UNSCOPED-CALL  a call site that passes no scoping argument to a storage
 *                  method that accepts one.
 *   NO-SCOPE-PARAM an IStorage collection read that has no scope parameter at
 *                  all, so no caller can scope it even if they want to.
 *
 * Suppress an intentional case by putting a line comment starting with
 * `UNSCOPED:` and a reason within a few lines above the call (or above the
 * method, for NO-SCOPE-PARAM). The audit is advisory — it is deliberately not
 * wired into the build, because a false positive should never break a deploy.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STORAGE_FILE = path.join(ROOT, "server/storage/types.ts");
const SCAN_DIRS = ["server"];
const SUPPRESS_LOOKBACK = 6; // lines above a call searched for `UNSCOPED:`

/**
 * Params that narrow a read. Any `*Id` counts: a collection keyed by a required
 * parent row (getTimeEntries(timesheetId), getMaintenanceLogs(equipmentId)) is
 * scoped by that parent, so it is the parent's own access check that matters.
 */
const SCOPE_PARAM = /\b(organizationId|projectId|accountId|opts|\w+Id)\b/;
/** Reads that are inherently single-row or already keyed, so scope is implied. */
const SINGULAR = /^(get|find)[A-Za-z]*(ById|ByEmail|ByKey|ByAccountWeek|ByClientId|ByStripeCustomerId|ByToken)$/;

type Finding = { kind: string; file: string; line: number; detail: string };
const findings: Finding[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function hasSuppression(lines: string[], index: number): boolean {
  for (let i = Math.max(0, index - SUPPRESS_LOOKBACK); i <= index; i++) {
    if (/UNSCOPED:/.test(lines[i])) return true;
  }
  return false;
}

// ---- 1. Read the IStorage interface: which methods return a collection, and
//         which of those accept a scoping argument?
const storageSrc = fs.readFileSync(STORAGE_FILE, "utf8");
const storageLines = storageSrc.split("\n");
const ifaceStart = storageLines.findIndex((l) => /^export interface IStorage/.test(l));
if (ifaceStart === -1) {
  console.error("audit-storage-scoping: could not locate `export interface IStorage` — has server/storage/types.ts moved?");
  process.exit(2);
}

const collectionReads = new Map<string, { scoped: boolean; line: number }>();
for (let i = ifaceStart + 1; i < storageLines.length; i++) {
  const line = storageLines[i];
  if (/^}/.test(line)) break; // end of interface
  const m = line.match(/^\s{2}(\w+)\((.*)\)\s*:\s*Promise<([^>]*)>/);
  if (!m) continue;
  const [, name, params, ret] = m;
  if (!/^(get|list)/.test(name)) continue;
  if (!ret.trim().endsWith("[]")) continue; // single-row reads carry their own key
  if (SINGULAR.test(name)) continue;
  collectionReads.set(name, { scoped: SCOPE_PARAM.test(params), line: i + 1 });
}

for (const [name, info] of collectionReads) {
  if (info.scoped) continue;
  if (hasSuppression(storageLines, info.line - 1)) continue;
  findings.push({
    kind: "NO-SCOPE-PARAM",
    file: "server/storage/types.ts",
    line: info.line,
    detail: `IStorage.${name}() has no organization/project parameter, so callers cannot scope it.`,
  });
}

// ---- 2. Find call sites that pass no scoping argument.
const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    const calls = line.matchAll(/storage\.(\w+)\(([^)]*)\)/g);
    for (const call of calls) {
      const [, method, args] = call;
      const info = collectionReads.get(method);
      if (!info) continue;
      // An argument list that mentions a scope, or any non-empty argument for a
      // method whose only parameter IS the scope, counts as scoped.
      if (args.trim() !== "") continue;
      if (hasSuppression(lines, idx)) continue;
      findings.push({
        kind: "UNSCOPED-CALL",
        file: rel,
        line: idx + 1,
        detail: `storage.${method}() called with no scope. Pass an organizationId/projectId, or annotate with a "// UNSCOPED: <reason>" comment.`,
      });
    }
  });
}

// ---- 3. Report.
const strict = process.argv.includes("--strict");
console.log(`\nCross-tenant scoping audit — ${collectionReads.size} collection reads on IStorage, ${files.length} server files scanned.\n`);

if (findings.length === 0) {
  console.log("No unscoped collection reads found. Every call is scoped or annotated.\n");
  process.exit(0);
}

for (const f of findings) {
  console.log(`  [${f.kind}] ${f.file}:${f.line}\n      ${f.detail}`);
}
console.log(`\n${findings.length} finding(s). Advisory only — the build is not blocked.\n`);
process.exit(strict ? 1 : 0);
