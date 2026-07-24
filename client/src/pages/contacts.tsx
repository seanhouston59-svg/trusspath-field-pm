import { useState } from "react";
import { Mail, Phone, Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { ContactTypeBadge } from "@/components/bits";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Contact } from "@shared/schema";

const TYPE_OPTIONS = ["Owner", "Architect", "Engineer", "Subcontractor", "Vendor", "Inspector", "Consultant", "GC"];

export default function Contacts() {
  const { data: contacts = [], isLoading } = useContacts();
  const create = useCreateContact();
  const update = useUpdateContact();
  const del = useDeleteContact();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const fields: FieldDef[] = [
    { name: "name", label: "Name", type: "text", required: true, half: true },
    { name: "company", label: "Company", type: "text", required: true, half: true },
    { name: "role", label: "Role", type: "text", required: true, half: true },
    { name: "type", label: "Type", type: "select", options: TYPE_OPTIONS.map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "trade", label: "Trade", type: "text", placeholder: "Electrical", required: true, half: true },
    { name: "phone", label: "Phone", type: "text", placeholder: "(303) 555-0100", required: true, half: true },
    { name: "email", label: "Email", type: "text", placeholder: "name@company.com", required: true },
  ];

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setOpen(true); };

  const defaults: Record<string, string | number> = editing
    ? { name: editing.name, company: editing.company, role: editing.role, type: editing.type, trade: editing.trade, phone: editing.phone, email: editing.email }
    : { type: "Subcontractor" };

  const handleSubmit = (v: Record<string, string | number>) => {
    const payload = {
      name: String(v.name), company: String(v.company), role: String(v.role),
      type: String(v.type), trade: String(v.trade), phone: String(v.phone), email: String(v.email),
    };
    if (editing) return update.mutateAsync({ id: editing.id, data: payload });
    return create.mutateAsync(payload);
  };

  const handleDelete = (c: Contact) => {
    if (!window.confirm(`Delete contact ${c.name}?`)) return;
    del.mutate(c.id, { onSuccess: () => toast({ title: "Contact deleted" }) });
  };

  return (
    <Layout title="Contacts" actions={
      <Button size="sm" onClick={openNew} data-testid="button-new-contact"><Plus className="size-4" /> Add Contact</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Contact" : "New Contact"}
        fields={fields}
        defaults={defaults}
        submitLabel={editing ? "Save Changes" : "Add Contact"}
        isPending={create.isPending || update.isPending}
        onSubmit={handleSubmit}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => (
            <div key={c.id} className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm" data-testid={`card-contact-${c.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-bold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.role}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => openEdit(c)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" data-testid={`button-edit-contact-${c.id}`} aria-label="Edit"><Pencil className="size-4" /></button>
                  <button onClick={() => handleDelete(c)} className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500" data-testid={`button-delete-contact-${c.id}`} aria-label="Delete"><Trash2 className="size-4" /></button>
                  <ContactTypeBadge type={c.type} />
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Building2 className="size-4 shrink-0" /> {c.company}</div>
                <div className="flex items-center gap-2"><Phone className="size-4 shrink-0" /> {c.phone}</div>
                <div className="flex items-center gap-2 truncate"><Mail className="size-4 shrink-0" /> <span className="truncate">{c.email}</span></div>
              </div>
              <div className="mt-3 border-t border-border pt-3 text-xs font-medium text-muted-foreground">{c.trade}</div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
