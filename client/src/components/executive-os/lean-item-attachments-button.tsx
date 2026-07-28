import { useRef, useState } from "react";
import { Paperclip, Trash2, Loader2, FileIcon, ImageIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  useDeleteLeanModuleItemAttachment,
  useLeanModuleItemAttachments,
  useUploadLeanModuleItemAttachment,
} from "@/hooks/use-lean-modules";

/**
 * Small paperclip trigger for each item row. Opens a popover with the item's
 * existing attachments (photo thumbnails + file rows), an upload input, and a
 * delete button per attachment. Count badge on the trigger reflects the
 * current attachment list.
 *
 * Kept self-contained so the item table doesn't need per-row state; each
 * mounted button owns its own popover/upload state.
 */
export function LeanItemAttachmentsButton({
  projectId,
  moduleId,
  itemId,
  itemTitle,
}: {
  projectId: number;
  moduleId: string;
  itemId: number;
  itemTitle: string;
}) {
  const { toast } = useToast();
  const attachments = useLeanModuleItemAttachments(projectId, moduleId, itemId);
  const upload = useUploadLeanModuleItemAttachment(projectId, moduleId);
  const remove = useDeleteLeanModuleItemAttachment(projectId, moduleId);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const rows = attachments.data ?? [];
  const count = rows.length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Sequential upload keeps the request queue simple and lets us surface
    // per-file errors without racing invalidations.
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ itemId, file });
      } catch (err) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-7"
          aria-label={`Attachments for ${itemTitle}`}
          data-testid={`lean-${moduleId}-attachments-${itemId}`}
        >
          <Paperclip className="size-3.5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Attachments</div>
          <div className="text-xs text-muted-foreground">{count} file{count === 1 ? "" : "s"}</div>
        </div>

        {attachments.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
            No files yet. Attach a photo or document below.
          </div>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded border bg-card px-2 py-1.5"
              >
                {row.kind === "photo" ? (
                  // Small preview so users can eyeball the image without
                  // opening it. Falls back to icon on load error.
                  <img
                    src={row.url}
                    alt={row.filename}
                    className="size-10 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded bg-muted">
                    <FileIcon className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium" title={row.filename}>
                    {row.filename}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {row.uploadedByName || "Unknown"}
                    {row.sizeBytes ? ` · ${formatBytes(row.sizeBytes)}` : ""}
                  </div>
                </div>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1 hover:bg-accent"
                  title="Open / download"
                  data-testid={`lean-${moduleId}-attachment-open-${row.id}`}
                >
                  <Download className="size-3.5" />
                </a>
                <button
                  type="button"
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  title="Delete attachment"
                  onClick={() => {
                    if (confirm(`Delete "${row.filename}"?`)) {
                      remove.mutate({ itemId, attachmentId: row.id });
                    }
                  }}
                  data-testid={`lean-${moduleId}-attachment-delete-${row.id}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            data-testid={`lean-${moduleId}-attachment-input-${itemId}`}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
            data-testid={`lean-${moduleId}-attachment-upload-${itemId}`}
          >
            {upload.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <ImageIcon className="mr-1.5 size-3.5" /> Attach file
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
