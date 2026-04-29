import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowDown, Plane, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { iataToCity } from "@/lib/iata";
import { airlineName } from "@/lib/airlines";

export type FlightSegment = {
  id: string;
  flight_option_id: string;
  user_id: string;
  ordre: number;
  compagnie: string | null;
  numero_vol: string | null;
  aeroport_depart: string;
  date_depart: string | null;
  heure_depart: string | null;
  aeroport_arrivee: string;
  date_arrivee: string | null;
  heure_arrivee: string | null;
  duree_escale_minutes: number | null;
  notes: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flightOptionId: string;
  defaultCompagnie?: string;
  defaultDateDepart?: string | null;
  defaultHeureDepart?: string | null;
  defaultDateRetour?: string | null;
  defaultHeureRetour?: string | null;
  canWrite: boolean;
};

const empty = (
  flightOptionId: string,
  userId: string,
  ordre: number,
  defaultCompagnie?: string,
  prev?: FlightSegment | null,
  fallbackDateDepart?: string | null,
  fallbackHeureDepart?: string | null,
): Omit<FlightSegment, "id"> => {
  // Calcule la date/heure de départ du nouveau segment :
  // - si segment précédent : on part de l'arrivée du précédent + escale (défaut 120 min)
  // - sinon : on prend les valeurs de l'option vol
  let date_depart: string | null = fallbackDateDepart ?? null;
  let heure_depart: string | null = fallbackHeureDepart ?? null;
  let aeroport_depart = "";

  if (prev) {
    aeroport_depart = prev.aeroport_arrivee || "";
    if (prev.date_arrivee && prev.heure_arrivee) {
      const escaleMin = prev.duree_escale_minutes ?? 120;
      const base = new Date(`${prev.date_arrivee}T${prev.heure_arrivee}`);
      base.setMinutes(base.getMinutes() + escaleMin);
      date_depart = base.toISOString().slice(0, 10);
      heure_depart = base.toTimeString().slice(0, 5);
    } else if (prev.date_arrivee) {
      date_depart = prev.date_arrivee;
    }
  }

  return {
    flight_option_id: flightOptionId,
    user_id: userId,
    ordre,
    compagnie: defaultCompagnie ?? null,
    numero_vol: null,
    aeroport_depart,
    date_depart,
    heure_depart,
    aeroport_arrivee: "",
    date_arrivee: null,
    heure_arrivee: null,
    duree_escale_minutes: null,
    notes: null,
  };
};

export function FlightSegmentsDialog({
  open,
  onOpenChange,
  flightOptionId,
  defaultCompagnie,
  defaultDateDepart,
  defaultHeureDepart,
  defaultDateRetour,
  defaultHeureRetour,
  canWrite,
}: Props) {
  const { user } = useAuth();
  const [segments, setSegments] = useState<FlightSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("flight_segments")
      .select("*")
      .eq("flight_option_id", flightOptionId)
      .order("ordre", { ascending: true });
    setSegments((data ?? []) as FlightSegment[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flightOptionId]);

  const addSegment = () => {
    if (!user) return;
    const nextOrdre = segments.length > 0 ? Math.max(...segments.map((s) => s.ordre)) + 1 : 1;
    const prev = segments.length > 0 ? segments[segments.length - 1] : null;
    // 1er segment : valeurs de l'option (aller).
    // Suivants : reprend l'arrivée du précédent + escale.
    const fallbackDate = !prev ? defaultDateDepart ?? null : null;
    const fallbackHeure = !prev ? defaultHeureDepart ?? null : null;
    setSegments([
      ...segments,
      {
        id: `tmp-${crypto.randomUUID()}`,
        ...empty(flightOptionId, user.id, nextOrdre, defaultCompagnie, prev, fallbackDate, fallbackHeure),
      },
    ]);
  };

  // Ajoute automatiquement un 1er segment vide pré-rempli si la fenêtre s'ouvre vide.
  useEffect(() => {
    if (!loading && open && segments.length === 0 && user && canWrite) {
      setSegments([
        {
          id: `tmp-${crypto.randomUUID()}`,
          ...empty(
            flightOptionId,
            user.id,
            1,
            defaultCompagnie,
            null,
            defaultDateDepart ?? null,
            defaultHeureDepart ?? null,
          ),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, open]);

  // ===== Import depuis capture d'écran (Lovable AI / Gemini vision) =====
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Lecture image impossible"));
      reader.readAsDataURL(file);
    });

  const handleImportImage = async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image trop lourde (max 8 Mo).");
      return;
    }
    setImporting(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("extract-flights", {
        body: { imageDataUrl },
      });
      if (error) throw error;
      const extracted = (data?.segments ?? []) as Array<{
        compagnie?: string;
        numero_vol?: string;
        aeroport_depart?: string;
        aeroport_arrivee?: string;
        date_depart?: string;
        heure_depart?: string;
        date_arrivee?: string;
        heure_arrivee?: string;
      }>;
      if (extracted.length === 0) {
        toast.warning("Aucun vol détecté sur cette image.");
        return;
      }
      // Remplace tous les segments tmp non sauvegardés ; conserve ceux déjà en DB.
      const persisted = segments.filter((s) => !s.id.startsWith("tmp-"));
      const startOrdre =
        persisted.length > 0 ? Math.max(...persisted.map((s) => s.ordre)) + 1 : 1;
      const newSegs: FlightSegment[] = extracted.map((seg, i) => ({
        id: `tmp-${crypto.randomUUID()}`,
        flight_option_id: flightOptionId,
        user_id: user.id,
        ordre: startOrdre + i,
        compagnie: seg.compagnie?.toUpperCase().trim() || defaultCompagnie || null,
        numero_vol: seg.numero_vol?.toUpperCase().trim() || null,
        aeroport_depart: (seg.aeroport_depart || "").toUpperCase().trim(),
        aeroport_arrivee: (seg.aeroport_arrivee || "").toUpperCase().trim(),
        date_depart: seg.date_depart || null,
        heure_depart: seg.heure_depart || null,
        date_arrivee: seg.date_arrivee || null,
        heure_arrivee: seg.heure_arrivee || null,
        duree_escale_minutes: null,
        notes: null,
      }));
      setSegments([...persisted, ...newSegs]);
      toast.success(`${newSegs.length} segment(s) extrait(s). Vérifiez puis enregistrez.`);
    } catch (e) {
      console.error("[import vol image]", e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse de l'image.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateSegment = (id: string, patch: Partial<FlightSegment>) => {
    setSegments((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      // Auto-recalcule les durées d'escale entre segments consécutifs
      // dès qu'on a arrivée(N) et départ(N+1) complets.
      for (let i = 0; i < next.length - 1; i++) {
        const cur = next[i];
        const nxt = next[i + 1];
        if (cur.date_arrivee && cur.heure_arrivee && nxt.date_depart && nxt.heure_depart) {
          const arr = new Date(`${cur.date_arrivee}T${cur.heure_arrivee}`);
          const dep = new Date(`${nxt.date_depart}T${nxt.heure_depart}`);
          const diffMin = Math.round((dep.getTime() - arr.getTime()) / 60000);
          if (diffMin > 0 && diffMin < 24 * 60 && cur.duree_escale_minutes !== diffMin) {
            next[i] = { ...cur, duree_escale_minutes: diffMin };
          }
        }
      }
      return next;
    });
  };

  const removeSegment = async (id: string) => {
    if (!id.startsWith("tmp-")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("flight_segments").delete().eq("id", id);
    }
    setSegments(segments.filter((s) => s.id !== id));
  };

  const saveAll = async () => {
    if (!user) return;
    for (const s of segments) {
      if (!s.aeroport_depart.trim() || !s.aeroport_arrivee.trim()) {
        toast.error(`Segment ${s.ordre} : aéroports départ et arrivée requis.`);
        return;
      }
    }
    setSaving(true);
    try {
      for (const s of segments) {
        const payload = {
          user_id: user.id,
          flight_option_id: flightOptionId,
          ordre: s.ordre,
          compagnie: s.compagnie?.trim() || null,
          numero_vol: s.numero_vol?.trim() || null,
          aeroport_depart: s.aeroport_depart.trim().toUpperCase(),
          date_depart: s.date_depart || null,
          heure_depart: s.heure_depart || null,
          aeroport_arrivee: s.aeroport_arrivee.trim().toUpperCase(),
          date_arrivee: s.date_arrivee || null,
          heure_arrivee: s.heure_arrivee || null,
          duree_escale_minutes: s.duree_escale_minutes ?? null,
          notes: s.notes?.trim() || null,
        };
        if (s.id.startsWith("tmp-")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from("flight_segments").insert(payload);
          if (error) throw error;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            .from("flight_segments")
            .update(payload)
            .eq("id", s.id);
          if (error) throw error;
        }
      }
      toast.success("Segments enregistrés.");
      await load();
    } catch (e) {
      console.error("[flight_segments save] erreur:", e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Erreur d'enregistrement.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            Segments du vol
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : (
          <div className="space-y-3">
            {segments.length === 0 && (
              <div className="text-sm text-muted-foreground italic text-center py-6 border border-dashed rounded">
                Aucun segment. Ajoutez le 1er segment du vol (ex : MRS → CDG).
              </div>
            )}

            {segments.map((s, idx) => (
              <div key={s.id} className="border rounded-md p-3 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Segment {idx + 1}
                  </div>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSegment(s.id)}
                      className="text-destructive h-7"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Compagnie (code/nom)</Label>
                    <Input
                      value={s.compagnie ?? ""}
                      onChange={(e) => updateSegment(s.id, { compagnie: e.target.value })}
                      placeholder="AF"
                      disabled={!canWrite}
                      className="h-9"
                    />
                    {s.compagnie && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                        → {airlineName(s.compagnie)}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">N° vol</Label>
                    <Input
                      value={s.numero_vol ?? ""}
                      onChange={(e) => updateSegment(s.id, { numero_vol: e.target.value })}
                      placeholder="AF006"
                      disabled={!canWrite}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Aéroport départ *</Label>
                    <Input
                      value={s.aeroport_depart}
                      onChange={(e) => updateSegment(s.id, { aeroport_depart: e.target.value.toUpperCase() })}
                      placeholder="MRS"
                      maxLength={3}
                      disabled={!canWrite}
                      className="h-9 uppercase"
                    />
                    {s.aeroport_depart && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                        → {iataToCity(s.aeroport_depart)}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Date départ</Label>
                    <Input
                      type="date"
                      value={s.date_depart ?? ""}
                      onChange={(e) => updateSegment(s.id, { date_depart: e.target.value || null })}
                      disabled={!canWrite}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Heure départ</Label>
                    <Input
                      type="time"
                      value={s.heure_depart?.slice(0, 5) ?? ""}
                      onChange={(e) => updateSegment(s.id, { heure_depart: e.target.value || null })}
                      disabled={!canWrite}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Aéroport arrivée *</Label>
                    <Input
                      value={s.aeroport_arrivee}
                      onChange={(e) => updateSegment(s.id, { aeroport_arrivee: e.target.value.toUpperCase() })}
                      placeholder="CDG"
                      maxLength={3}
                      disabled={!canWrite}
                      className="h-9 uppercase"
                    />
                    {s.aeroport_arrivee && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                        → {iataToCity(s.aeroport_arrivee)}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Date arrivée</Label>
                    <Input
                      type="date"
                      value={s.date_arrivee ?? ""}
                      onChange={(e) => updateSegment(s.id, { date_arrivee: e.target.value || null })}
                      disabled={!canWrite}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Heure arrivée</Label>
                    <Input
                      type="time"
                      value={s.heure_arrivee?.slice(0, 5) ?? ""}
                      onChange={(e) => updateSegment(s.id, { heure_arrivee: e.target.value || null })}
                      disabled={!canWrite}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Escale après (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={s.duree_escale_minutes ?? ""}
                      onChange={(e) =>
                        updateSegment(s.id, {
                          duree_escale_minutes: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="120"
                      disabled={!canWrite}
                      className="h-9"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Notes (terminal, bagages…)</Label>
                  <Input
                    value={s.notes ?? ""}
                    onChange={(e) => updateSegment(s.id, { notes: e.target.value })}
                    disabled={!canWrite}
                    className="h-9"
                  />
                </div>

                {idx < segments.length - 1 && s.duree_escale_minutes && (
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-1">
                    <ArrowDown className="h-3 w-3" />
                    Escale {Math.floor(s.duree_escale_minutes / 60)}h
                    {String(s.duree_escale_minutes % 60).padStart(2, "0")}
                  </div>
                )}
              </div>
            ))}

            {canWrite && (
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={addSegment} variant="outline" size="sm">
                  <Plus className="h-3 w-3 mr-1" /> Ajouter un segment
                </Button>
                <Button onClick={saveAll} disabled={saving || segments.length === 0}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
