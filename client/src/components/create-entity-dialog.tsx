import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, ChevronDown } from "lucide-react";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { cn } from "@/lib/utils";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "combo" | "photo" | "info" | "address";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  half?: boolean;
  info?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldDef[];
  defaults: Record<string, string | number>;
  submitLabel?: string;
  isPending?: boolean;
  onSubmit: (values: Record<string, string | number>) => Promise<void> | void;
  /** Fires whenever a field value changes. Return a partial update to also patch
   *  other fields (e.g. selecting a Position also fills Access Level). */
  onFieldChange?: (name: string, value: string | number, values: Record<string, string | number>) => Record<string, string | number> | void;
  /** Optional filter to hide/show fields dynamically based on current values.
   *  Runs on every render so "reveal on Other…" style flows work out of the
   *  box without duplicating the dialog. */
  fieldsForValues?: (values: Record<string, string | number>) => FieldDef[];
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CreateEntityDialog({
  open, onOpenChange, title, fields, defaults, submitLabel = "Save", isPending = false, onSubmit, onFieldChange, fieldsForValues,
}: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(defaults);
  const [error, setError] = useState<string | null>(null);

  // reset form state whenever the dialog opens
  useEffect(() => {
    if (open) {
      const seeded: Record<string, string | number> = {};
      for (const f of fields) {
        if (defaults[f.name] !== undefined) seeded[f.name] = defaults[f.name];
        else if (f.type === "date") seeded[f.name] = today();
        else if (f.type === "number") seeded[f.name] = 0;
        else seeded[f.name] = "";
      }
      setValues(seeded);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name: string, v: string | number) => setValues((s) => {
    const next = { ...s, [name]: v };
    // Let the parent inject additional field updates in response to this change.
    const patch = onFieldChange?.(name, v, next);
    return patch ? { ...next, ...patch } : next;
  });

  // Effective field list — filtered on every render so `fieldsForValues` can
  // hide/show rows in response to current values (e.g. only show the "custom
  // trade" text box when the trade dropdown is set to Other).
  const activeFields = fieldsForValues ? fieldsForValues(values) : fields;

  const submit = async () => {
    // Only validate the fields currently visible — hidden "Other…" text
    // boxes should never trip the required check.
    const missing = activeFields.filter((f) => f.required && (values[f.name] === "" || values[f.name] === undefined));
    if (missing.length) {
      setError(`Please fill in: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setError(null);
    const payload: Record<string, string | number> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === "number") payload[f.name] = v === "" || v === undefined ? 0 : Number(v);
      else payload[f.name] = v ?? "";
    }
    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {activeFields.map((f) => {
            const colSpan = f.half ? "sm:col-span-1" : "sm:col-span-2";
            const ctype = f.type ?? "text";
            return (
              <div key={f.name} className={`space-y-1.5 ${colSpan}`}>
                <Label htmlFor={f.name} className="text-xs font-medium text-muted-foreground">
                  {f.label}{f.required && <span className="text-primary"> *</span>}
                </Label>

                {ctype === "textarea" ? (
                  <Textarea
                    id={f.name} rows={3}
                    value={String(values[f.name] ?? "")}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.name, e.target.value)}
                    data-testid={`field-${f.name}`}
                  />
                ) : ctype === "address" ? (
                  <AddressAutocomplete
                    id={f.name}
                    value={String(values[f.name] ?? "")}
                    onChange={(v) => set(f.name, v)}
                    placeholder={f.placeholder ?? "Start typing an address…"}
                    multiline
                    data-testid={`field-${f.name}`}
                  />
                ) : ctype === "photo" ? (
                  <div className="space-y-2">
                    {values[f.name] ? (
                      <div className="relative inline-block">
                        <img src={String(values[f.name])} alt={f.label} className="h-20 w-20 rounded-lg border border-border object-cover" data-testid={`preview-${f.name}`} />
                        <button type="button" onClick={() => set(f.name, "")} className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-red-500 text-white shadow" aria-label="Remove photo" data-testid={`remove-${f.name}`}><X className="size-3" /></button>
                      </div>
                    ) : (
                      <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary" data-testid={`field-${f.name}`}>
                        <ImagePlus className="size-4" /> Upload {f.label}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const dataUrl: string = await new Promise((resolve, reject) => {
                            const r = new FileReader();
                            r.onload = () => resolve(String(r.result));
                            r.onerror = reject;
                            r.readAsDataURL(file);
                          });
                          set(f.name, dataUrl);
                        }} />
                      </label>
                    )}
                  </div>
                ) : ctype === "select" ? (
                  <Select value={String(values[f.name] ?? "")} onValueChange={(v) => set(f.name, v)}>
                    <SelectTrigger id={f.name} data-testid={`field-${f.name}`}>
                      <SelectValue placeholder={f.placeholder ?? "Select…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : ctype === "combo" ? (
                  <ComboBox
                    id={f.name}
                    value={String(values[f.name] ?? "")}
                    options={f.options ?? []}
                    placeholder={f.placeholder ?? "Start typing…"}
                    onChange={(v) => set(f.name, v)}
                    testId={`field-${f.name}`}
                  />
                ) : ctype === "info" ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid={`field-${f.name}`}>
                    {f.info || "Auto-generated"}
                  </div>
                ) : (
                  <Input
                    id={f.name}
                    type={ctype === "number" ? "number" : ctype === "date" ? "date" : "text"}
                    value={String(values[f.name] ?? "")}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.name, e.target.value)}
                    data-testid={`field-${f.name}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-500" data-testid="form-error">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={isPending} data-testid="button-submit">
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- ComboBox --------------------------------------------------------
// Type-to-filter combo box: renders a text input the user can either free-type
// into or pick from a filtered dropdown of curated options. There's no separate
// "Other…" mode — whatever's in the text field is what gets saved. Keyboard:
// ArrowUp/Down highlights, Enter accepts, Esc closes. Click outside closes.
type ComboProps = {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange: (value: string) => void;
  testId?: string;
};

function ComboBox({ id, value, options, placeholder, onChange, testId }: ComboProps) {
  const [openList, setOpenList] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Filtering: match anywhere in the label, case-insensitive. If the input is
  // empty we show every option (users can just click the chevron and browse).
  const q = value.trim().toLowerCase();
  const filtered = q.length === 0
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(q));

  useEffect(() => {
    // Reset highlight whenever the filtered list changes so it can't point off
    // the end of the array.
    setHighlight(0);
  }, [q, options.length]);

  useEffect(() => {
    if (!openList) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpenList(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openList]);

  const commit = (v: string) => {
    onChange(v);
    setOpenList(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpenList(true); }}
          onFocus={() => setOpenList(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpenList(true);
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (openList && filtered[highlight]) {
                e.preventDefault();
                commit(filtered[highlight].value);
              }
            } else if (e.key === "Escape") {
              setOpenList(false);
            }
          }}
          className="pr-9"
          autoComplete="off"
          data-testid={testId}
        />
        <button
          type="button"
          onClick={() => setOpenList((o) => !o)}
          className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Toggle options"
          tabIndex={-1}
        >
          <ChevronDown className={cn("size-4 transition-transform", openList && "rotate-180")} />
        </button>
      </div>
      {openList && filtered.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-lg"
          data-testid={`${testId}-list`}
        >
          {filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(o.value); }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-left transition-colors",
                highlight === i ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {openList && filtered.length === 0 && value.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover px-2 py-2 text-xs text-muted-foreground shadow-lg">
          No matches — press Enter to keep “{value.trim()}”
        </div>
      )}
    </div>
  );
}
