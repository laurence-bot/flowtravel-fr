import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { ALL_COUNTRIES } from "@/lib/countries";
import { toast } from "sonner";

export type EditableContact = {
  id: string;
  nom: string;
  type: "client" | "fournisseur";
  email: string | null;
  telephone: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  pays?: string | null;
  site_web?: string | null;
  contact_principal?: string | null;
  notes?: string | null;
};

const schema = z.object({
  nom: z.string().trim().min(1, "Le nom est requis").max(200),
  type: z.enum(["client", "fournisseur"]),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  telephone: z.string().trim().max(40).optional().or(z.literal("")),
  adresse: z.string().trim().max(300).optional().or(z.literal("")),
  code_postal: z.string().trim().max(20).optional().or(z.literal("")),
  ville: z.string().trim().max(120).optional().or(z.literal("")),
  pays: z.string().trim().max(120).optional().or(z.literal("")),
  site_web: z.string().trim().max(255).optional().or(z.literal("")),
  contact_principal: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type Props = {
  contact: EditableContact;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
};

export function ContactEditDialog({ contact, open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nom: contact.nom,
    type: contact.type,
    email: contact.email ?? "",
    telephone: contact.telephone ?? "",
    adresse: contact.adresse ?? "",
    code_postal: contact.code_postal ?? "",
    ville: contact.ville ?? "",
    pays: contact.pays ?? "",
    site_web: contact.site_web ?? "",
    contact_principal: contact.contact_principal ?? "",
    notes: contact.notes ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        nom: contact.nom,
        type: contact.type,
        email: contact.email ?? "",
        telephone: contact.telephone ?? "",
        adresse: contact.adresse ?? "",
        code_postal: contact.code_postal ?? "",
        ville: contact.ville ?? "",
        pays: contact.pays ?? "",
        site_web: contact.site_web ?? "",
        contact_principal: contact.contact_principal ?? "",
        notes: contact.notes ?? "",
      });
    }
  }, [open, contact]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const payload = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("contacts")
      .update(payload)
      .eq("id", contact.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "contact",
      entityId: contact.id,
      action: "update",
      description: `Contact modifié : ${parsed.data.nom}`,
    });
    toast.success("Contact mis à jour.");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Modifier le contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "client" | "fournisseur" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="fournisseur">Fournisseur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact principal</Label>
              <Input
                value={form.contact_principal}
                onChange={(e) => setForm({ ...form, contact_principal: e.target.value })}
                placeholder="Nom du référent"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Site web</Label>
              <Input
                value={form.site_web}
                onChange={(e) => setForm({ ...form, site_web: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Code postal</Label>
              <Input
                value={form.code_postal}
                onChange={(e) => setForm({ ...form, code_postal: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ville</Label>
              <Input
                value={form.ville}
                onChange={(e) => setForm({ ...form, ville: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Select value={form.pays || "none"} onValueChange={(v) => setForm({ ...form, pays: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {ALL_COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes internes…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
