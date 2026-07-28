import { ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/mobilization/bits";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import {
  useCreateStakeholder, useUpdateStakeholder, useDeleteStakeholder,
} from "@/hooks/use-project-setup";
import { PROJECT_SETUP_STAKEHOLDER_ROLES } from "@shared/project-setup-catalog";
import type { ProjectSetupStakeholder } from "@shared/schema";
import { SaveStatusPill } from "./fields";

type SaveCell = (id: number, patch: Record<string, unknown>) => Promise<unknown>;
type TextField = "role" | "organization" | "name" | "title" | "email" | "phone";

const ROLE_LIST_ID = "project-setup-stakeholder-roles";

function CellInput({ row, field, save, type, listId }: {
  row: ProjectSetupStakeholder;
  field: TextField;
  save: SaveCell;
  type?: string;
  listId?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    row[field] ?? "",
    async (v) => {
      // role is NOT NULL — an empty box would 500 on the way to the database.
      const next = v.trim() === "" ? (field === "role" ? "" : null) : v;
      if (field === "role" && next === "") return;
      await save(row.id, { [field]: next });
    },
  );
  return (
    <Input
      type={type}
      value={value}
      list={listId}
      onChange={(e) => setValue(e.target.value)}
      className="h-8 min-w-[8rem]"
      data-testid={`stakeholder-${row.id}-${field}`}
    />
  );
}

function CellNotes({ row, save }: { row: ProjectSetupStakeholder; save: SaveCell }) {
  const { value, setValue } = useDebouncedSave<string>(
    row.notes ?? "",
    async (v) => { await save(row.id, { notes: v.trim() === "" ? null : v }); },
  );
  return (
    <Textarea
      value={value}
      rows={2}
      onChange={(e) => setValue(e.target.value)}
      className="min-w-[12rem] text-sm"
    />
  );
}

const HEADERS = ["Role", "Organization", "Name", "Title", "Email", "Phone", "Notes", ""];

export function StakeholdersTab({ stakeholders, projectId }: {
  stakeholders: ProjectSetupStakeholder[];
  projectId: number | undefined;
}) {
  const create = useCreateStakeholder(projectId);
  const update = useUpdateStakeholder(projectId);
  const remove = useDeleteStakeholder(projectId);

  const save: SaveCell = (id, patch) => update.mutateAsync({ id, ...patch });

  // Rows arrive ordered by (sortOrder, id), so swapping the pair's sortOrder
  // moves a row exactly one position.
  const move = (i: number, dir: -1 | 1) => {
    const a = stakeholders[i];
    const b = stakeholders[i + dir];
    if (!a || !b) return;
    update.mutate({ id: a.id, sortOrder: b.sortOrder });
    update.mutate({ id: b.id, sortOrder: a.sortOrder });
  };

  const add = (role: string) =>
    create.mutate({ role, sortOrder: stakeholders.length });

  return (
    <div className="space-y-3">
      <datalist id={ROLE_LIST_ID}>
        {PROJECT_SETUP_STAKEHOLDER_ROLES.map((r) => <option key={r} value={r} />)}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Quick add</span>
        {PROJECT_SETUP_STAKEHOLDER_ROLES.map((role) => (
          <Button
            key={role} size="sm" variant="outline" className="h-7 text-xs"
            disabled={create.isPending}
            onClick={() => add(role)}
            data-testid={`stakeholder-quickadd-${role.replace(/\s+/g, "-").toLowerCase()}`}
          >
            <Plus className="size-3" /> {role}
          </Button>
        ))}
        <div className="ml-auto"><SaveStatusPill mutations={[create, update, remove]} /></div>
      </div>

      {stakeholders.length === 0 ? (
        <EmptyState
          message="Add stakeholders to populate the Project Directory in the Charter and Kickoff Agenda."
          action={<Button onClick={() => add("Owner Rep")} disabled={create.isPending}>Add first stakeholder</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {HEADERS.map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stakeholders.map((row, i) => (
                <tr key={row.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-2 py-2"><CellInput row={row} field="role" save={save} listId={ROLE_LIST_ID} /></td>
                  <td className="px-2 py-2"><CellInput row={row} field="organization" save={save} /></td>
                  <td className="px-2 py-2"><CellInput row={row} field="name" save={save} /></td>
                  <td className="px-2 py-2"><CellInput row={row} field="title" save={save} /></td>
                  <td className="px-2 py-2"><CellInput row={row} field="email" save={save} type="email" /></td>
                  <td className="px-2 py-2"><CellInput row={row} field="phone" save={save} type="tel" /></td>
                  <td className="px-2 py-2"><CellNotes row={row} save={save} /></td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <Button
                      size="icon" variant="ghost" className="size-7" disabled={i === 0}
                      onClick={() => move(i, -1)} aria-label={`Move ${row.role} up`}
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="size-7" disabled={i === stakeholders.length - 1}
                      onClick={() => move(i, 1)} aria-label={`Move ${row.role} down`}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="size-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => remove.mutate(row.id)} aria-label={`Remove ${row.role}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
