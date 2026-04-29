import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { generatePublicToken, type QuotePublicLink } from "@/lib/quote-public";
import { formatDate } from "@/lib/format";
import { Sparkles, Copy, Check, ExternalLink, Eye, ThumbsUp, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";

type Props = {
  cotationId: string;
  userId: string;
  canWrite: boolean;
};

export function PublicQuoteLinkBlock({ cotationId, userId, canWrite }: Props) {
  const [link, setLink] = useState<QuotePublicLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("quote_public_links")
      .select("*")
      .eq("cotation_id", cotationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLink(data ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotationId]);

  const createLink = async () => {
    setCreating(true);
    const token = generatePublicToken();
    const expires = new Date();
    expires.setDate(expires.getDate() + 90);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("quote_public_links")
      .insert({
        user_id: userId,
        cotation_id: cotationId,
        token,
        expires_at: expires.toISOString(),
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLink(data);
    toast.success("Lien client généré.");
  };

  const publicUrl = link
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${link.token}`
    : "";

  const copy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Lien copié.");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">Chargement du lien client…</Card>
    );
  }

  return (
    <Card className="p-5 border-[color:var(--gold)]/30 bg-gradient-to-br from-accent/30 to-transparent">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
            <h3 className="font-display text-lg">Devis web client</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Page immersive partageable, à votre marque, avec validation et rappel intégrés.
          </p>
        </div>
        {!link && canWrite && (
          <Button onClick={createLink} disabled={creating} size="sm">
            {creating ? "Génération…" : "Générer le lien"}
          </Button>
        )}
      </div>

      {link && (
        <>
          <div className="flex gap-2 mb-4">
            <Input value={publicUrl} readOnly className="font-mono text-xs" />
            <Button onClick={copy} variant="outline" size="icon" title="Copier">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="icon" title="Aperçu">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Stat
              icon={<Eye className="h-3.5 w-3.5" />}
              label="Vu par le client"
              value={link.viewed_at ? formatDate(link.viewed_at) : "Pas encore"}
              active={!!link.viewed_at}
            />
            <Stat
              icon={<ThumbsUp className="h-3.5 w-3.5" />}
              label="Validé"
              value={link.accepted_at ? formatDate(link.accepted_at) : "—"}
              active={!!link.accepted_at}
              tone="success"
            />
            <Stat
              icon={<Phone className="h-3.5 w-3.5" />}
              label="Rappel demandé"
              value={link.callback_requested_at ? formatDate(link.callback_requested_at) : "—"}
              active={!!link.callback_requested_at}
              tone="warn"
            />
            <Stat
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Modification"
              value={link.modification_requested_at ? formatDate(link.modification_requested_at) : "—"}
              active={!!link.modification_requested_at}
              tone="warn"
            />
          </div>

          {link.modification_request_text && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded text-xs">
              <div className="font-medium text-warning-foreground mb-1">
                Demande de modification du client :
              </div>
              <div className="text-muted-foreground whitespace-pre-line">
                {link.modification_request_text}
              </div>
            </div>
          )}

          <div className="mt-4 text-[11px] text-muted-foreground">
            Expire le {formatDate(link.expires_at)}
          </div>
        </>
      )}
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  active,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  tone?: "neutral" | "success" | "warn";
}) {
  const colors = active
    ? tone === "success"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-foreground"
    : "text-muted-foreground";
  return (
    <div className="border border-border/60 rounded p-2.5 bg-card/60">
      <div className={`flex items-center gap-1.5 mb-1 ${colors}`}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-medium ${colors}`}>{value}</div>
    </div>
  );
}
