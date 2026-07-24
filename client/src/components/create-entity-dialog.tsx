import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "photo";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  half?: boolean;
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
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CreateEntityDialog({
  open, onOpenChange, title, fields, defaults, submitLabel = "Save", isPending = false, onSubmit,
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

  const set = (name: string, v: string | number) => setValues((s) => ({ ...s, [name]: v }));

  const submit = async () => {
    const missing = fields.filter((f) => f.required && (values[f.name] === "" || values[f.name] === undefined));
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
          {fields.map((f) => {
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
