import { useState } from "react";
import {
  Trash2, RotateCcw, AlertTriangle, FileText, Clock, X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useDeletedItems, useRestoreItem, usePermanentDeleteItem, useEmptyDeletedItems,
} from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import type { DeletedItem } from "@shared/schema";

const ENTITY_LABELS: Record<string, string> = {
  tasks: "Task",
  rfis: "RFI",
  submittals: "Submittal",
  "change-orders": "Change Order",
  "action-items": "Action Item",
  "punch-items": "Punch Item",
  "daily-logs": "Daily Log",
  photos: "Photo",
  documents: "Document",
  "company-documents": "Company Document",
  equipment: "Equipment",
  contacts: "Contact",
  notes: "Note",
  blueprints: "Blueprint",
  milestones: "Milestone",
  "team-members": "Team Member",
  "drone-captures": "Drone Capture",
};

function getItemName(item: DeletedItem): string {
  try {
    const data = JSON.parse(item.data);
    return data.title || data.name || data.subject || data.caption || data.label || data.content?.slice(0, 60) || data.date || `Item #${item.entityId}`;
  } catch {
    return `Item #${item.entityId}`;
  }
}

function shortDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

export default function DeletedItemsPage() {
  const { data: items = [], isLoading } = useDeletedItems();
  const restoreMut = useRestoreItem();
  const permDeleteMut = usePermanentDeleteItem();
  const emptyMut = useEmptyDeletedItems();
  const { toast } = useToast();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DeletedItem | null>(null);

  const handleRestore = async (item: DeletedItem) => {
    try {
      await restoreMut.mutateAsync({ type: item.entityType, id: item.entityId });
      toast({ title: `${ENTITY_LABELS[item.entityType] ?? "Item"} restored`, description: getItemName(item) });
    } catch {
      toast({ title: "Restore failed", variant: "destructive" });
    }
  };

  const handlePermanentDelete = async (item: DeletedItem) => {
    try {
      await permDeleteMut.mutateAsync({ type: item.entityType, id: item.entityId });
      toast({ title: "Item permanently deleted" });
      setConfirmDelete(null);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleEmpty = async () => {
    try {
      await emptyMut.mutateAsync();
      toast({ title: "Recycle bin emptied" });
      setConfirmEmpty(false);
    } catch {
      toast({ title: "Failed to empty bin", variant: "destructive" });
    }
  };

  return (
    <Layout
      title="Deleted Items"
      actions={items.length > 0 ? (
        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmEmpty(true)} data-testid="button-empty-bin">
          <Trash2 className="size-4" /> Empty Bin
        </Button>
      ) : undefined}
    >
      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <Trash2 className="size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Recycle bin is empty</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Deleted items will appear here for recovery</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Deleted</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30" data-testid={`row-deleted-${item.entityType}-${item.entityId}`}>
                  <td className="px-4 py-2.5">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {ENTITY_LABELS[item.entityType] ?? item.entityType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{getItemName(item)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.projectName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{shortDate(item.deletedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(item)}
                        disabled={restoreMut.isPending}
                        data-testid={`button-restore-${item.entityType}-${item.entityId}`}
                      >
                        <RotateCcw className="size-3.5" /> Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setConfirmDelete(item)}
                        data-testid={`button-perm-delete-${item.entityType}-${item.entityId}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm permanent delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Delete permanently?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete "{confirmDelete ? getItemName(confirmDelete) : ""}" from the recycle bin.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handlePermanentDelete(confirmDelete)} disabled={permDeleteMut.isPending} data-testid="button-confirm-perm-delete">
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm empty bin */}
      <Dialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Empty recycle bin?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all {items.length} item{items.length !== 1 ? "s" : ""} in the recycle bin.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEmpty(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleEmpty} disabled={emptyMut.isPending} data-testid="button-confirm-empty">
              Empty Bin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
