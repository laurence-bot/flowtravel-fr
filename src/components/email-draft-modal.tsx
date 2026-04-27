import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Mail, X } from "lucide-react";
import { toast } from "sonner";
import type { EmailDraft } from "@/lib/options";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  draft: EmailDraft | null;
  /** Callback déclenché après copie ou ouverture mailto (pour journaliser). */
  onSent?: (finalDraft: EmailDraft) => void;
};

/**
 * Modal d'édition d'un brouillon email avant envoi.
 * Ne fait JAMAIS d'envoi automatique : copie presse-papier ou ouverture mailto.
 */
export function EmailDraftModal({ open, onOpenChange, title, draft, onSent }: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (draft) {
      setTo(draft.to);
      setSubject(draft.subject);
      setBody(draft.body);
    }
  }, [draft]);

  const finalDraft = (): EmailDraft => ({ to, subject, body });

  const copy = async () => {
    const text = `À : ${to}\nObjet : ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Email copié dans le presse-papier.");
      onSent?.(finalDraft());
    } catch {
      toast.error("Copie impossible.");
    }
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Corps de l'email copié.");
    } catch {
      toast.error("Copie impossible.");
    }
  };

  const openMailto = () => {
    const params = new URLSearchParams({ subject, body });
    const href = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
    window.open(href, "_blank");
    onSent?.(finalDraft());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Aucun envoi automatique. Modifiez l'email puis copiez-le ou ouvrez votre client mail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Destinataire</Label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="contact@fournisseur.com"
            />
          </div>
          <div>
            <Label className="text-xs">Objet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Corps de l'email</Label>
            <Textarea
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" /> Fermer
            </Button>
            <Button variant="outline" onClick={copyBody}>
              <Copy className="h-4 w-4 mr-1" /> Copier le corps
            </Button>
            <Button variant="outline" onClick={copy}>
              <Copy className="h-4 w-4 mr-1" /> Copier tout
            </Button>
            <Button onClick={openMailto} disabled={!to}>
              <Mail className="h-4 w-4 mr-1" /> Ouvrir dans mon mail
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
