import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ImagePicker } from "@/components/image-picker";
import { generateDayText } from "@/server/quote-day-text.functions";
import { suggestDayPhoto } from "@/server/quote-images.functions";
import { generateQuoteIntro } from "@/server/quote-intro.functions";
import type { CotationJour, Inclusions } from "@/lib/quote-public";
import { detectInclusions, generateInclusText } from "@/lib/detect-inclusions";
import { InclusionPills } from "@/components/cotation/InclusionPills";
import { InclusionToggles } from "@/components/cotation/InclusionToggles";
import { ListChecks } from "lucide-react";
import {
  ImageIcon,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wand2,
  X,
  Plane,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  buildItineraryFromFlights,
  pickReferenceFlight,
  type FlightOptionLite,
  type FlightSegmentLite,
} from "@/lib/itinerary-from-flights";
import { buildJourSyncPlan, duplicateLineKey, normKey, type SyncJour } from "@/lib/cotation-sync";
import { extractProgramFromFile, insertJours, insertLignes, purgeEtReinserer } from "@/lib/program-import";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDate } from "@/lib/format";

const MAX_GALLERY = 4;

type Props = {
  cotationId: string;
  userId: string;
  canWrite: boolean;
  initialHeroUrl: string | null;
  initialStorytelling: string | null;
  initialInclus?: string | null;
  initialNonInclus?: string | null;
  titre?: string | null;
  destination?: string | null;
  paysDestination?: string | null;
  typeVoyage?: string | null;
  nombrePax?: number | null;
  dateDepart?: string | null;
  dateRetour?: string | null;
  programmePdfUrl?: string | null;
  programmePdfName?: string | null;
  onDataChanged?: () => void;
};

export function QuoteContentEditorBlock({
  cotationId,
  userId,
  canWrite,
  initialHeroUrl,
  initialStorytelling,
  initialInclus,
  initialNonInclus,
  titre,
  destination,
  paysDestination,
  typeVoyage,
  nombrePax,
  dateDepart,
  dateRetour,
  programmePdfUrl,
  programmePdfName,
  onDataChanged,
}: Props) {
  const [heroUrl, setHeroUrl] = useState<string | null>(initialHeroUrl);
  const [storytelling, setStorytelling] = useState(initialStorytelling ?? "");
  const [inclus, setInclus] = useState(initialInclus ?? "");
  const [nonInclus, setNonInclus] = useState(initialNonInclus ?? "");
  const [savingHero, setSavingHero] = useState(false);
  const [jours, setJours] = useState<CotationJour[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [resyncLoading, setResyncLoading] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [hasFlights, setHasFlights] = useState(false);
  const [genIntroLoading, setGenIntroLoading] = useState(false);
  const [genInclusLoading, setGenInclusLoading] = useState(false);
  const callGenerateIntro = useServerFn(generateQuoteIntro);

  const generateInclus = async () => {
    setGenInclusLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optsRes = await (supabase as any).from("flight_options").select("id").eq("cotation_id", cotationId);
      const optionIds = ((optsRes.data ?? []) as Array<{ id: string }>).map((v) => v.id);

      let segments: Array<{ aeroport_depart: string; aeroport_arrivee: string }> = [];
      if (optionIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const segsRes = await (supabase as any)
          .from("flight_segments")
          .select("aeroport_depart, aeroport_arrivee")
          .in("flight_option_id", optionIds);
        segments = (segsRes.data ?? []) as typeof segments;
      }

      const hasVolInternational = segments.some(
        (s) => s.aeroport_depart.slice(0, 2) !== s.aeroport_arrivee.slice(0, 2),
      );
      const hasVolDomestique = segments.some((s) => s.aeroport_depart.slice(0, 2) === s.aeroport_arrivee.slice(0, 2));

      const { inclus_text, non_inclus_text } = generateInclusText({
        jours: jours.map((j) => ({
          titre: j.titre,
          description: j.description,
          date_jour: j.date_jour,
          inclusions: j.inclusions ?? null,
        })),
        nombrePax: nombrePax ?? 2,
        hasVolInternational,
        hasVolDomestique,
      });

      setInclus(inclus_text);
      setNonInclus(non_inclus_text);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("cotations")
        .update({
          inclus_text: inclus_text || null,
          non_inclus_text: non_inclus_text || null,
        })
        .eq("id", cotationId);

      if (error) toast.error(error.message);
      else toast.success("Inclusions générées depuis le programme.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de génération.");
    } finally {
      setGenInclusLoading(false);
    }
  };

  const handleGenerateIntro = async () => {
    setGenIntroLoading(true);
    try {
      const res = await callGenerateIntro({
        data: {
          titre: titre ?? null,
          destination: destination ?? null,
          paysDestination: paysDestination ?? null,
          typeVoyage: typeVoyage ?? null,
          nombrePax: nombrePax ?? null,
          dateDepart: dateDepart ?? null,
          dateRetour: dateRetour ?? null,
          jours: jours.map((j) => ({
            ordre: j.ordre,
            titre: j.titre,
            lieu: j.lieu,
            description: j.description,
          })),
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStorytelling(res.text);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("cotations")
        .update({ storytelling_intro: res.text })
        .eq("id", cotationId);
      if (error) toast.error(error.message);
      else toast.success("Introduction générée.");
    } finally {
      setGenIntroLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    loadJours();
    void checkFlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotationId]);

  const checkFlights = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("flight_options")
      .select("id", { count: "exact", head: true })
      .eq("cotation_id", cotationId);
    setHasFlights((count ?? 0) > 0);
  };

  const loadJours = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("cotation_jours")
      .select("*")
      .eq("cotation_id", cotationId)
      .order("ordre", { ascending: true });
    const rows = ((data as CotationJour[]) ?? []).map((j) => ({
      ...j,
      gallery_urls: Array.isArray(j.gallery_urls) ? j.gallery_urls : [],
      gallery_credits: Array.isArray(j.gallery_credits) ? j.gallery_credits : [],
    }));
    setJours(rows);
    setLoading(false);
  };

  const updateHero = async (url: string | null) => {
    setHeroUrl(url);
    setSavingHero(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("cotations").update({ hero_image_url: url }).eq("id", cotationId);
    setSavingHero(false);
    if (error) toast.error(error.message);
    else toast.success("Image principale mise à jour.");
  };

  const saveStorytelling = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ storytelling_intro: storytelling || null })
      .eq("id", cotationId);
    if (error) toast.error(error.message);
  };

  const saveInclus = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ inclus_text: inclus || null })
      .eq("id", cotationId);
    if (error) toast.error(error.message);
  };

  const saveNonInclus = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cotations")
      .update({ non_inclus_text: nonInclus || null })
      .eq("id", cotationId);
    if (error) toast.error(error.message);
  };

  /** Date auto pour un jour donné (basée sur date_depart + index). */
  const computeAutoDate = (index: number): string | null => {
    if (!dateDepart) return null;
    const d = new Date(dateDepart);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + index);
    return d.toISOString().slice(0, 10);
  };

  // Suit toutes les image_url déjà utilisées dans les jours
  const usedPhotoUrls = useMemo(() => new Set(jours.map((j) => j.image_url).filter(Boolean) as string[]), [jours]);

  const addJour = async () => {
    const ordre = jours.length > 0 ? Math.max(...jours.map((j) => j.ordre)) + 1 : 1;
    const autoDate = computeAutoDate(jours.length);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("cotation_jours")
      .insert({
        user_id: userId,
        cotation_id: cotationId,
        ordre,
        titre: `Jour ${ordre}`,
        date_jour: autoDate,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const row: CotationJour = {
      ...(data as CotationJour),
      gallery_urls: [],
      gallery_credits: [],
    };
    setJours([...jours, row]);
  };

  const updateJour = async (id: string, patch: Partial<CotationJour>) => {
    setJours((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("cotation_jours").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteJour = async (id: string) => {
    if (!confirm("Supprimer ce jour ?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("cotation_jours").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setJours((prev) => prev.filter((j) => j.id !== id));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = jours.findIndex((j) => j.id === active.id);
    const newIdx = jours.findIndex((j) => j.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(jours, oldIdx, newIdx).map((j, i) => ({
      ...j,
      ordre: i + 1,
    }));
    setJours(reordered);

    // Persist tous les nouveaux ordres en parallèle
    const updates = reordered.map((j) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("cotation_jours").update({ ordre: j.ordre }).eq("id", j.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed) toast.error("Erreur lors du réordonnancement.");
  };

  /** A-t-on déjà du contenu utilisateur dans les jours ? */
  const joursHaveContent = (): boolean => {
    return jours.some(
      (j) =>
        (j.description && j.description.trim().length > 0) ||
        (j.image_url && j.image_url.length > 0) ||
        (j.gallery_urls && j.gallery_urls.length > 0) ||
        (j.lieu && j.lieu.trim().length > 0),
    );
  };

  const handleRegenClick = () => {
    if (!hasFlights) {
      toast.error("Aucun vol renseigné. Ajoutez d'abord les vols pour générer l'itinéraire.");
      return;
    }
    if (jours.length > 0 && joursHaveContent()) {
      setRegenOpen(true);
    } else {
      void runRegenerate();
    }
  };

  /** Nettoyage de masse : retire les doublons évidents sans toucher au PDF source. */
  const cleanDuplicates = async () => {
    setCleanLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: joursData }, { data: lignesData }] = await Promise.all([
        (supabase as any)
          .from("cotation_jours")
          .select("id, ordre, titre, description, date_jour, created_at, image_url, gallery_urls, lieu, hotel_nom")
          .eq("cotation_id", cotationId)
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("cotation_lignes_fournisseurs")
          .select("id, prestation, montant_devise, devise, nom_fournisseur, created_at")
          .eq("cotation_id", cotationId)
          .order("created_at", { ascending: true }),
      ]);

      const seenJours = new Map<string, string>(); // key → id (on garde le premier)
      const jourIds: string[] = [];
      const sortedJours = [...((joursData ?? []) as SyncJour[])].sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
      );
      for (const j of sortedJours) {
        const key = `${j.date_jour ?? ""}|${normKey(j.titre).slice(0, 80)}`;
        if (seenJours.has(key)) {
          jourIds.push(j.id);
        } else {
          seenJours.set(key, j.id);
        }
      }
      let removedJours = 0;
      if (jourIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("cotation_jours").delete().in("id", jourIds);
        if (error) throw error;
        removedJours = jourIds.length;
      }

      const seenLines = new Set<string>();
      const lineIds: string[] = [];
      for (const l of (lignesData ?? []) as Array<{
        id: string;
        prestation: string | null;
        montant_devise: number | null;
        devise: string | null;
        nom_fournisseur: string | null;
      }>) {
        const key = duplicateLineKey(l);
        if (seenLines.has(key)) lineIds.push(l.id);
        else seenLines.add(key);
      }
      let removedLines = 0;
      if (lineIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("cotation_lignes_fournisseurs").delete().in("id", lineIds);
        if (error) throw error;
        removedLines = lineIds.length;
      }

      if (removedJours === 0 && removedLines === 0) toast.success("Aucun doublon évident détecté.");
      else toast.success(`${removedJours} jour(s) doublon et ${removedLines} ligne(s) doublon supprimé(s).`);
      await loadJours();
      onDataChanged?.();
    } catch (e) {
      console.error("[clean duplicates] erreur:", e);
      toast.error(e instanceof Error ? e.message : "Erreur pendant le nettoyage.");
    } finally {
      setCleanLoading(false);
    }
  };

  const enrichHotels = async () => {
    const joursAvecHotel = jours.filter((j) => {
      if (j.hotel_url) return false;
      if (j.hotel_nom?.trim()) return true;
      const desc = (j.description ?? "") + " " + (j.titre ?? "");
      return /\b(hotel|hôtel|lodge|resort|riad|villa|THE\s+\w+\s+HOTEL|HOTEL\s+\w+)\b/i.test(desc);
    });

    if (joursAvecHotel.length === 0) {
      toast.info(
        "Aucun hôtel à enrichir. Saisissez le nom de l'hôtel dans chaque jour pour déclencher l'enrichissement.",
      );
      return;
    }
    setEnrichLoading(true);
    let enriched = 0;
    let failed = 0;
    try {
      for (const jour of joursAvecHotel) {
        try {
          let hotelNom = jour.hotel_nom?.trim();
          if (!hotelNom) {
            const desc = (jour.description ?? "") + " " + (jour.titre ?? "");
            const match = desc.match(
              /\b(THE\s+[\w\s]+HOTEL|[\w\s]+HOTEL|HOTEL\s+[\w\s]+|[\w\s]+ Lodge|[\w\s]+ Resort|[\w\s]+ Riad)\b/i,
            );
            hotelNom = match?.[1]?.trim();
          }
          if (!hotelNom) {
            failed++;
            continue;
          }

          const { data, error } = await supabase.functions.invoke("enrich-hotel", {
            body: { hotel_nom: hotelNom, lieu: jour.lieu ?? destination ?? null },
          });
          if (error || !data) {
            failed++;
            continue;
          }

          const patch: Partial<CotationJour> = {};
          if (data.hotel_nom_confirme) patch.hotel_nom = data.hotel_nom_confirme;
          if (data.hotel_url) patch.hotel_url = data.hotel_url;
          if (data.hotel_photo_url) patch.hotel_photo_url = data.hotel_photo_url;

          if (Object.keys(patch).length > 0) {
            await updateJour(jour.id, patch);
            enriched++;
          }
          await new Promise((r) => setTimeout(r, 800));
        } catch {
          failed++;
        }
      }
      if (enriched > 0) toast.success(`${enriched} hôtel(s) enrichi(s).`);
      if (failed > 0)
        toast.warning(`${failed} hôtel(s) non trouvé(s) — saisissez le nom manuellement dans le champ hôtel du jour.`);
      if (enriched === 0 && failed === 0) toast.info("Aucun hôtel détecté. Saisissez les noms manuellement.");
    } finally {
      setEnrichLoading(false);
    }
  };

  const [enrichPhotosLoading, setEnrichPhotosLoading] = useState(false);
  const suggestPhotoFn = useServerFn(suggestDayPhoto);

  const enrichPhotos = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: freshJours } = await (supabase as any)
      .from("cotation_jours")
      .select("id, titre, lieu, description, image_url")
      .eq("cotation_id", cotationId)
      .order("ordre", { ascending: true });

    const joursWithout = (
      (freshJours ?? []) as Array<{
        id: string;
        titre: string;
        lieu: string | null;
        description: string | null;
        image_url: string | null;
      }>
    ).filter((j) => !j.image_url);

    if (joursWithout.length === 0) {
      toast.info("Tous les jours ont déjà une photo.");
      return;
    }

    setEnrichPhotosLoading(true);
    let done = 0;
    let failed = 0;

    const sessionUsedUrls = new Set<string>(
      ((freshJours ?? []) as Array<{ image_url: string | null }>).map((j) => j.image_url).filter(Boolean) as string[],
    );

    try {
      for (const jour of joursWithout) {
        try {
          const r = await suggestPhotoFn({
            data: {
              titre: jour.titre,
              lieu: jour.lieu ?? null,
              description: jour.description ?? null,
              destination: destination ?? null,
              excludeIds: [...sessionUsedUrls],
            },
          });
          if (!r.ok) {
            failed++;
            continue;
          }

          if (sessionUsedUrls.has(r.photo.url) || sessionUsedUrls.has(r.photo.full)) {
            failed++;
            continue;
          }

          const res = await fetch(r.photo.full);
          const blob = await res.blob();
          const path = `${userId}/${cotationId}/jour-${jour.id}-${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("quote-images")
            .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });
          if (upErr) {
            failed++;
            continue;
          }

          const { data: pubData } = supabase.storage.from("quote-images").getPublicUrl(path);

          sessionUsedUrls.add(pubData.publicUrl);
          sessionUsedUrls.add(r.photo.url);
          sessionUsedUrls.add(r.photo.full);

          await updateJour(jour.id, {
            image_url: pubData.publicUrl,
            image_credit: r.photo.credit,
          });
          done++;
          await new Promise((res2) => setTimeout(res2, 800));
        } catch {
          failed++;
        }
      }
      if (done > 0) toast.success(`${done} photo(s) ajoutée(s).`);
      if (failed > 0) toast.warning(`${failed} jour(s) sans photo unique — essayez l'onglet Unsplash manuellement.`);
    } finally {
      setEnrichPhotosLoading(false);
      await loadJours();
    }
  };

  const [detectInclusionsLoading, setDetectInclusionsLoading] = useState(false);
  const detectAllInclusions = async () => {
    setDetectInclusionsLoading(true);
    let count = 0;
    try {
      for (const jour of jours) {
        const detected = detectInclusions({
          titre: jour.titre,
          description: jour.description,
          jourDate: jour.date_jour,
        });
        if (Object.keys(detected).length > 0) {
          await updateJour(jour.id, { inclusions: detected });
          count++;
        }
      }
      toast.success(`Inclusions détectées sur ${count} jour(s).`);
    } finally {
      setDetectInclusionsLoading(false);
    }
  };
  const resyncProgramAndFlights = async () => {
    setResyncLoading(true);
    try {
      const [volsRes, linkRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("flight_options")
          .select("*")
          .eq("cotation_id", cotationId)
          .order("created_at", { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("quote_public_links")
          .select("chosen_flight_option_id")
          .eq("cotation_id", cotationId)
          .maybeSingle(),
      ]);
      const vols = (volsRes.data ?? []) as FlightOptionLite[];
      const chosenId = (linkRes.data?.chosen_flight_option_id ?? null) as string | null;
      const refVol = pickReferenceFlight(vols, chosenId);
      let segments: FlightSegmentLite[] = [];
      let generated = [] as ReturnType<typeof buildItineraryFromFlights>;
      let newDepart = dateDepart ?? null;
      let newRetour = dateRetour ?? null;

      if (refVol) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: segs } = await (supabase as any)
          .from("flight_segments")
          .select("*")
          .eq("flight_option_id", refVol.id)
          .order("ordre", { ascending: true });
        segments = (segs ?? []) as FlightSegmentLite[];
        const sorted = [...segments].sort((a, b) => a.ordre - b.ordre);
        newDepart = sorted[0]?.date_depart ?? refVol.date_depart ?? newDepart;
        newRetour = sorted[sorted.length - 1]?.date_arrivee ?? refVol.date_retour ?? newRetour;

        // Charger aussi les segments des vols annexes (domestiques stockés en option séparée)
        // pour que enrichVolsDomestiques enrichisse les bons jours d'itinéraire.
        const otherVolIds = vols.filter((v) => v.id !== refVol.id).map((v) => v.id);
        let extraSegments: FlightSegmentLite[] = [];
        if (otherVolIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: extraSegs } = await (supabase as any)
            .from("flight_segments")
            .select("*")
            .in("flight_option_id", otherVolIds)
            .order("ordre", { ascending: true });
          extraSegments = (extraSegs ?? []) as FlightSegmentLite[];
        }

        generated = buildItineraryFromFlights(refVol, [...segments, ...extraSegments], newDepart, newRetour);
        if (newDepart && newRetour) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: cotErr } = await (supabase as any)
            .from("cotations")
            .update({ date_depart: newDepart, date_retour: newRetour })
            .eq("id", cotationId);
          if (cotErr) throw cotErr;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allJoursData } = await (supabase as any)
        .from("cotation_jours")
        .select("id, ordre, titre, description, date_jour, created_at, image_url, gallery_urls, lieu, hotel_nom")
        .eq("cotation_id", cotationId)
        .order("ordre", { ascending: true });
      const plan = buildJourSyncPlan({
        existing: (allJoursData ?? []) as SyncJour[],
        generatedFromFlights: generated,
        fallbackStart: newDepart,
        fallbackEnd: newRetour,
      });

      if (plan.deleteIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: delErr } = await (supabase as any).from("cotation_jours").delete().in("id", plan.deleteIds);
        if (delErr) throw delErr;
      }

      const results = await Promise.all(
        plan.updates.map((u) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("cotation_jours").update(u.patch).eq("id", u.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;

      if (plan.inserts.length > 0) {
        const newRows = plan.inserts.map((row) => ({
          user_id: jours[0]?.user_id ?? userId,
          cotation_id: cotationId,
          ...row,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insErr } = await (supabase as any).from("cotation_jours").insert(newRows);
        if (insErr) throw insErr;
      }

      let importedPdfJours = 0;
      let skippedPdfJours = 0;
      let importedPdfLines = 0;
      let skippedPdfLines = 0;
      if (programmePdfUrl) {
        const { data: signed } = await supabase.storage.from("pdf-imports").createSignedUrl(programmePdfUrl, 120);
        if (signed?.signedUrl) {
          const blob = await fetch(signed.signedUrl).then((r) => {
            if (!r.ok) throw new Error("PDF importé inaccessible.");
            return r.blob();
          });
          const file = new File([blob], programmePdfName ?? "programme.pdf", { type: "application/pdf" });
          const extracted = await extractProgramFromFile(file);
          if (extracted.result) {
            const r = await purgeEtReinserer(userId, cotationId, extracted.result);
            if (r.error) throw new Error(r.error);
            importedPdfJours = extracted.result.jours.length;
            skippedPdfJours = 0;
            importedPdfLines = extracted.result.lignes.length;
            skippedPdfLines = 0;
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lignesData } = await (supabase as any)
        .from("cotation_lignes_fournisseurs")
        .select("id, prestation, montant_devise, devise, nom_fournisseur, created_at")
        .eq("cotation_id", cotationId)
        .order("created_at", { ascending: true });
      const seen = new Set<string>();
      const dupIds: string[] = [];
      for (const l of (lignesData ?? []) as Array<{
        id: string;
        prestation: string | null;
        montant_devise: number | null;
        devise: string | null;
        nom_fournisseur: string | null;
      }>) {
        const key = duplicateLineKey(l);
        if (seen.has(key)) dupIds.push(l.id);
        else seen.add(key);
      }
      let removedDups = 0;
      if (dupIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: dupErr } = await (supabase as any)
          .from("cotation_lignes_fournisseurs")
          .delete()
          .in("id", dupIds);
        if (dupErr) throw dupErr;
        removedDups = dupIds.length;
      }

      const msgParts = [`${plan.targetCount} jour${plan.targetCount > 1 ? "s" : ""} synchronisé(s)`];
      if (plan.deleteIds.length > 0) msgParts.push(`${plan.deleteIds.length} jour(s) doublon/en trop supprimé(s)`);
      if (plan.inserts.length > 0) msgParts.push(`${plan.inserts.length} jour(s) ajouté(s)`);
      if (importedPdfJours > 0 || importedPdfLines > 0)
        msgParts.push(`${importedPdfJours} jour(s) PDF et ${importedPdfLines} ligne(s) PDF importé(s)`);
      if (skippedPdfJours > 0 || skippedPdfLines > 0)
        msgParts.push(`${skippedPdfJours + skippedPdfLines} doublon(s) PDF ignoré(s)`);
      if (removedDups > 0) msgParts.push(`${removedDups} ligne(s) doublon retirée(s)`);
      if (plan.conflicts.length > 0) toast.warning(`Synchronisé avec alertes — ${plan.conflicts.join(" ")}`);
      toast.success(`Synchronisation OK — ${msgParts.join(", ")}.`);
      await loadJours();
      onDataChanged?.();
    } catch (e) {
      console.error("[resync dates] erreur:", e);
      toast.error(e instanceof Error ? e.message : "Erreur de resynchronisation.");
    } finally {
      setResyncLoading(false);
    }
  };

  const runRegenerate = async () => {
    setRegenOpen(false);
    setRegenLoading(true);
    try {
      // 1. Charger vols + segments + lien public (pour vol choisi)
      const [volsRes, linkRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("flight_options")
          .select("*")
          .eq("cotation_id", cotationId)
          .order("created_at", { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("quote_public_links")
          .select("chosen_flight_option_id")
          .eq("cotation_id", cotationId)
          .maybeSingle(),
      ]);
      const vols = (volsRes.data ?? []) as FlightOptionLite[];
      if (vols.length === 0) {
        toast.error("Aucun vol trouvé.");
        return;
      }
      const chosenId = (linkRes.data?.chosen_flight_option_id ?? null) as string | null;
      const refVol = pickReferenceFlight(vols, chosenId);
      if (!refVol) {
        toast.error("Vol de référence introuvable.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: segs } = await (supabase as any)
        .from("flight_segments")
        .select("*")
        .eq("flight_option_id", refVol.id)
        .order("ordre", { ascending: true });
      const segments = (segs ?? []) as FlightSegmentLite[];
      if (segments.length === 0) {
        toast.error("Aucun segment de vol — saisissez les segments du vol d'abord.");
        return;
      }

      const generated = buildItineraryFromFlights(refVol, segments, dateDepart ?? null, dateRetour ?? null);
      if (generated.length === 0) {
        toast.error("Impossible de calculer les dates depuis les vols.");
        return;
      }

      // 2. Effacer les jours existants
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase as any).from("cotation_jours").delete().eq("cotation_id", cotationId);
      if (delErr) throw delErr;

      // 3. Insérer les nouveaux jours
      const payload = generated.map((g) => ({
        user_id: userId,
        cotation_id: cotationId,
        ordre: g.ordre,
        titre: g.titre,
        description: g.description,
        lieu: g.lieu,
        date_jour: g.date_jour,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase as any).from("cotation_jours").insert(payload);
      if (insErr) throw insErr;

      toast.success(`${generated.length} jours générés depuis les vols.`);
      await loadJours();
    } catch (e) {
      console.error("[regen itinerary] erreur:", e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la régénération.");
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <Card className="p-5 space-y-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-[color:var(--gold)]" />
        <h3 className="font-display text-lg">Contenu du devis web</h3>
        {savingHero && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* HERO */}
      <div className="space-y-2">
        <Label>Image principale (Hero)</Label>
        <ImagePicker
          value={heroUrl}
          onChange={(url) => updateHero(url)}
          userId={userId}
          cotationId={cotationId}
          pathPrefix="hero"
          buttonLabel="Ajouter l'image principale du voyage"
          aspect="wide"
          disabled={!canWrite}
        />
      </div>

      {/* STORYTELLING */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label htmlFor="storytelling">Introduction narrative (optionnel)</Label>
          {canWrite && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerateIntro}
              disabled={genIntroLoading || jours.length === 0}
              title={
                jours.length === 0
                  ? "Rédigez d'abord le programme jour par jour"
                  : "Générer une phrase d'accroche à partir de votre programme"
              }
            >
              {genIntroLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Générer avec l'IA
            </Button>
          )}
        </div>
        <Textarea
          id="storytelling"
          value={storytelling}
          onChange={(e) => setStorytelling(e.target.value)}
          onBlur={saveStorytelling}
          placeholder="Une phrase d'accroche poétique qui plante le décor du voyage…"
          rows={3}
          maxLength={500}
          disabled={!canWrite}
        />
        <div className="text-[10px] text-muted-foreground text-right">{storytelling.length}/500</div>
      </div>

      {/* JOURS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label>Itinéraire jour par jour ({jours.length})</Label>
          {canWrite && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void resyncProgramAndFlights()}
                disabled={resyncLoading || (!hasFlights && jours.length === 0 && !programmePdfUrl)}
                title="Synchronise le programme PDF avec les dates de vol et alerte en cas d'écart"
              >
                {resyncLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sync PDF + vols
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void cleanDuplicates()}
                disabled={cleanLoading}
                title="Supprime en masse les doublons de jours et de lignes prix"
              >
                {cleanLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Doublons
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void enrichHotels()}
                disabled={enrichLoading}
                title="Recherche automatiquement le site officiel et une photo pour chaque hôtel détecté dans le programme"
              >
                {enrichLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Hôtels
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void enrichPhotos()}
                disabled={enrichPhotosLoading || jours.every((j) => !!j.image_url)}
                title="Cherche automatiquement une photo Unsplash premium pour chaque jour sans photo"
              >
                {enrichPhotosLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-1" />
                )}
                Photos
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void detectAllInclusions()}
                disabled={detectInclusionsLoading || jours.length === 0}
                title="Détecte automatiquement les inclusions depuis le texte de chaque jour"
              >
                {detectInclusionsLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ListChecks className="h-4 w-4 mr-1" />
                )}
                Inclusions
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenClick}
                disabled={regenLoading || !hasFlights}
                title={
                  hasFlights
                    ? "Construit l'itinéraire à partir des vols saisis"
                    : "Ajoutez d'abord les vols pour activer cette option"
                }
              >
                {regenLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plane className="h-4 w-4 mr-1" />}
                {jours.length === 0 ? "Générer" : "Depuis les vols"}
              </Button>
              <Button size="sm" variant="outline" onClick={addJour}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un jour
              </Button>
            </div>
          )}
        </div>
        {!hasFlights && jours.length === 0 && (
          <div className="text-xs text-muted-foreground bg-muted/50 border border-dashed rounded p-3 flex items-start gap-2">
            <Plane className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[color:var(--gold)]" />
            <div>
              <strong>Les vols définissent la structure du voyage.</strong> Saisissez d'abord vos vols (option vol +
              segments) puis cliquez sur <em>« Générer depuis les vols »</em>
              pour construire automatiquement le calendrier jour par jour.
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-6">Chargement…</div>
        ) : jours.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
            Aucun jour défini. Ajoutez-en pour construire l'itinéraire.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={jours.map((j) => j.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {jours.map((j, idx) => (
                  <SortableJour
                    key={j.id}
                    jour={j}
                    index={idx}
                    autoDate={computeAutoDate(idx)}
                    userId={userId}
                    cotationId={cotationId}
                    canWrite={canWrite}
                    destination={destination ?? null}
                    usedPhotoUrls={usedPhotoUrls}
                    onUpdate={(patch) => updateJour(j.id, patch)}
                    onDelete={() => deleteJour(j.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* INCLUS / NON INCLUS */}
      <div className="pt-2 border-t space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold">Inclusions du voyage</h3>
          {canWrite && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void generateInclus()}
              disabled={genInclusLoading || jours.length === 0}
              title="Génère les inclusions depuis le programme jour par jour"
            >
              {genInclusLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-1" />
              )}
              Générer depuis le programme
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inclus" className="text-sm font-medium">
              Ce qui est inclus
            </Label>
            <Textarea
              id="inclus"
              value={inclus}
              onChange={(e) => setInclus(e.target.value)}
              onBlur={saveInclus}
              placeholder={
                "• Vols internationaux aller-retour\n• Hébergement en chambre double\n• Transferts privés\n• Guide francophone…"
              }
              rows={10}
              disabled={!canWrite}
              className="text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">Format libre — une ligne par item, commencez par • ou -</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="non-inclus" className="text-sm font-medium">
              À prévoir / non inclus
            </Label>
            <Textarea
              id="non-inclus"
              value={nonInclus}
              onChange={(e) => setNonInclus(e.target.value)}
              onBlur={saveNonInclus}
              placeholder={
                "• Visa et formalités administratives\n• Assurance voyage\n• Repas non mentionnés\n• Boissons\n• Pourboires\n• Dépenses personnelles…"
              }
              rows={10}
              disabled={!canWrite}
              className="text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Renommé "À prévoir" sur la page client pour un ton plus positif.
            </p>
          </div>
        </div>
      </div>

      {/* CONFIRMATION RÉGÉNÉRATION */}
      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-[color:var(--gold)]" />
              Régénérer l'itinéraire depuis les vols ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Des jours existent déjà avec du contenu (textes, photos, lieux). La régénération va{" "}
              <strong>supprimer tous les jours actuels</strong> et reconstruire un nouveau squelette à partir des dates
              de vol. Vos textes et images seront perdus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void runRegenerate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ============================================================
 *  Sortable item (un jour)
 * ============================================================ */

function SortableJour(props: {
  jour: CotationJour;
  index: number;
  autoDate: string | null;
  userId: string;
  cotationId: string;
  canWrite: boolean;
  destination: string | null;
  usedPhotoUrls: Set<string>;
  onUpdate: (patch: Partial<CotationJour>) => void;
  onDelete: () => void;
}) {
  const { jour } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: jour.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <JourEditor {...props} dragHandleProps={{ ...attributes, ...listeners }} isDragging={isDragging} />
    </div>
  );
}

function JourEditor({
  jour,
  index,
  autoDate,
  userId,
  cotationId,
  canWrite,
  destination,
  usedPhotoUrls,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging,
}: {
  jour: CotationJour;
  index: number;
  autoDate: string | null;
  userId: string;
  cotationId: string;
  canWrite: boolean;
  destination: string | null;
  usedPhotoUrls: Set<string>;
  onUpdate: (patch: Partial<CotationJour>) => void;
  onDelete: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps: any;
  isDragging: boolean;
}) {
  const [titre, setTitre] = useState(jour.titre);
  const [lieu, setLieu] = useState(jour.lieu ?? "");
  const [description, setDescription] = useState(jour.description ?? "");
  const [date, setDate] = useState(jour.date_jour ?? "");
  const [open, setOpen] = useState(false);
  const [inclusions, setInclusions] = useState<Inclusions>(jour.inclusions ?? {});

  // Détection auto au montage si aucune inclusion existante
  useEffect(() => {
    if (jour.inclusions && Object.keys(jour.inclusions).length > 0) {
      // Si vol domestique détecté et titre ne le mentionne pas → enrichit le titre
      if (jour.inclusions.vol_domestique === true && !jour.titre.toLowerCase().includes("vol") && canWrite) {
        const titreParts = jour.titre.split(/\s*[-–—]\s*/);
        if (titreParts.length >= 2) {
          const newTitre = titreParts.map((part, idx) => (idx === 1 ? `${part} (vol domestique)` : part)).join(" - ");
          if (newTitre !== jour.titre) {
            setTitre(newTitre);
            onUpdate({ titre: newTitre });
          }
        }
      }
      return;
    }
    const detected = detectInclusions({
      titre: jour.titre,
      description: jour.description,
      jourDate: jour.date_jour,
    });
    if (Object.keys(detected).length > 0) {
      setInclusions(detected);
      onUpdate({ inclusions: detected });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jour.id]);

  const saveInclusions = (updated: Inclusions) => {
    setInclusions(updated);
    onUpdate({ inclusions: updated });
  };
  const [aiOpen, setAiOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generate = useServerFn(generateDayText);
  const [suggestingPhoto, setSuggestingPhoto] = useState(false);
  const suggestPhoto = useServerFn(suggestDayPhoto);

  const runSuggestPhoto = async () => {
    setSuggestingPhoto(true);
    try {
      // Tente jusqu'à 3 queries différentes pour éviter les doublons
      const queries = [
        { titre: titre || jour.titre, lieu: lieu || jour.lieu || null },
        { titre: lieu || jour.lieu || jour.titre, lieu: null as string | null },
        { titre: `${lieu || jour.lieu || ""} landscape`.trim(), lieu: null as string | null },
      ];

      let chosenPhoto: {
        id: string;
        url: string;
        full: string;
        thumb: string;
        alt: string;
        author: string;
        credit: string;
      } | null = null;

      for (const q of queries) {
        const r = await suggestPhoto({
          data: {
            titre: q.titre,
            lieu: q.lieu,
            description: description || jour.description || null,
            destination: destination || null,
            excludeIds: [...usedPhotoUrls],
          },
        });
        if (!r.ok) continue;

        const isDuplicate = usedPhotoUrls.has(r.photo.url) || usedPhotoUrls.has(r.photo.full);

        if (!isDuplicate) {
          chosenPhoto = r.photo;
          break;
        }
        console.log(`[suggestPhoto] doublon détecté (${r.photo.id}), nouvelle tentative…`);
      }

      if (!chosenPhoto) {
        toast.warning(
          "Toutes les photos suggérées sont déjà utilisées — ouvrez l'onglet Unsplash pour choisir manuellement.",
        );
        return;
      }

      const res = await fetch(chosenPhoto.full);
      const blob = await res.blob();
      const path = `${jour.user_id}/${jour.cotation_id}/jour-${jour.id}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("quote-images")
        .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data: pubData } = supabase.storage.from("quote-images").getPublicUrl(path);
      onUpdate({
        image_url: pubData.publicUrl,
        image_credit: chosenPhoto.credit,
      });
      toast.success(`Photo ajoutée : ${chosenPhoto.credit}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suggestion.");
    } finally {
      setSuggestingPhoto(false);
    }
  };

  // Synchroniser état local si la prop change (drag → re-render)
  useEffect(() => {
    setTitre(jour.titre);
    setLieu(jour.lieu ?? "");
    setDescription(jour.description ?? "");
    setDate(jour.date_jour ?? "");
  }, [jour.id, jour.titre, jour.lieu, jour.description, jour.date_jour]);

  const displayDate = date || autoDate || "";

  const runGenerate = async (extra?: { hebergement?: string; activites?: string; ambiance?: string }) => {
    setGenerating(true);
    const r = await generate({
      data: {
        titre: titre || null,
        lieu: lieu || null,
        destination: destination || null,
        typeVoyage: null,
        hebergement: extra?.hebergement || null,
        activites: extra?.activites || null,
        ambiance: extra?.ambiance || null,
      },
    });
    setGenerating(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setDescription(r.text);
    onUpdate({ description: r.text });
    toast.success("Texte généré.");
  };

  const addToGallery = (url: string, credit: string | null) => {
    const newUrls = [...(jour.gallery_urls ?? []), url].slice(0, MAX_GALLERY);
    const newCredits = [...(jour.gallery_credits ?? []), credit ?? ""].slice(0, MAX_GALLERY);
    onUpdate({ gallery_urls: newUrls, gallery_credits: newCredits });
  };

  const removeFromGallery = (i: number) => {
    const newUrls = [...(jour.gallery_urls ?? [])];
    const newCredits = [...(jour.gallery_credits ?? [])];
    newUrls.splice(i, 1);
    newCredits.splice(i, 1);
    onUpdate({ gallery_urls: newUrls, gallery_credits: newCredits });
  };

  const galleryCount = jour.gallery_urls?.length ?? 0;
  const canAddMore = galleryCount < MAX_GALLERY;

  return (
    <div className={`border rounded-md bg-card/50 ${isDragging ? "shadow-lg ring-2 ring-primary/40" : ""}`}>
      {/* HEADER */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          {...dragHandleProps}
          disabled={!canWrite}
          className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Réordonner"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
          J{index + 1}
        </div>
        <Input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          onBlur={() => titre !== jour.titre && onUpdate({ titre })}
          placeholder="Titre du jour"
          disabled={!canWrite}
          className="font-medium"
        />
        {displayDate && (
          <div className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(displayDate)}
          </div>
        )}
        {canWrite && (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Replier" : "Déplier"}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="text-destructive" aria-label="Supprimer">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* PASTILLES INCLUSIONS (visibles tout le temps) */}
      {Object.keys(inclusions).length > 0 && (
        <div className="px-3 pb-3 -mt-1">
          <InclusionPills inclusions={inclusions} variant="compact" />
        </div>
      )}

      {/* CONTENT */}
      {open && (
        <div className="p-4 pt-0 grid md:grid-cols-[220px_1fr] gap-4 border-t">
          {/* COL GAUCHE : image + meta */}
          <div className="space-y-3 pt-4">
            <div>
              <Label className="text-xs">Photo principale</Label>
              <ImagePicker
                value={jour.image_url}
                onChange={(url, meta) =>
                  onUpdate({
                    image_url: url,
                    image_credit: url ? (meta?.credit ?? null) : null,
                  })
                }
                userId={userId}
                cotationId={cotationId}
                pathPrefix={`jour-${jour.id}`}
                buttonLabel="Image du jour"
                aspect="video"
                disabled={!canWrite}
              />
              {jour.image_credit && (
                <div className="text-[10px] text-muted-foreground mt-1 italic">{jour.image_credit}</div>
              )}
            </div>

            <div>
              <Label className="text-xs">Lieu</Label>
              <Input
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                onBlur={() => lieu !== (jour.lieu ?? "") && onUpdate({ lieu: lieu || null })}
                placeholder="ex: Marrakech"
                disabled={!canWrite}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">
                Date {autoDate && !date && <span className="text-muted-foreground">(auto)</span>}
              </Label>
              <Input
                type="date"
                value={date || autoDate || ""}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => {
                  const newVal = date || null;
                  if (newVal !== (jour.date_jour ?? null)) onUpdate({ date_jour: newVal });
                }}
                disabled={!canWrite}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* COL DROITE : description + galerie */}
          <div className="pt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Description</Label>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => runGenerate()}
                      disabled={generating}
                    >
                      {generating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1 text-[color:var(--gold)]" />
                      )}
                      {generating ? "Génération…" : "Générer le texte"}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setAiOpen(true)}
                      disabled={generating}
                      title="Affiner avec des détails"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={runSuggestPhoto}
                      disabled={suggestingPhoto || !!jour.image_url}
                      title={
                        jour.image_url
                          ? "Une photo existe déjà — supprimez-la d'abord pour en suggérer une autre"
                          : "Cherche automatiquement la meilleure photo Unsplash pour ce jour"
                      }
                    >
                      {suggestingPhoto ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Search className="h-3 w-3 mr-1 text-[color:var(--gold)]" />
                      )}
                      {suggestingPhoto ? "Recherche…" : "Suggérer photo"}
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() =>
                  description !== (jour.description ?? "") && onUpdate({ description: description || null })
                }
                placeholder="Décrivez le déroulé de la journée, les visites, les ambiances… ou cliquez sur ✨ Générer le texte."
                rows={6}
                disabled={!canWrite}
                className="text-sm"
              />
            </div>

            {/* GALERIE */}
            <div>
              <Label className="text-xs">
                Galerie secondaire ({galleryCount}/{MAX_GALLERY})
              </Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {(jour.gallery_urls ?? []).map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="relative aspect-square rounded overflow-hidden border bg-muted group"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => removeFromGallery(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Supprimer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {jour.gallery_credits?.[i] && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1 text-[8px] text-white truncate">
                        {jour.gallery_credits[i]}
                      </div>
                    )}
                  </div>
                ))}
                {canAddMore && canWrite && (
                  <GalleryAddSlot userId={userId} cotationId={cotationId} jourId={jour.id} onAdd={addToGallery} />
                )}
              </div>
            </div>

            {/* HOTEL */}
            <HotelBlock jour={jour} canWrite={canWrite} userId={userId} cotationId={cotationId} onUpdate={onUpdate} />

            {/* INCLUSIONS */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Inclusions du jour</Label>
                {canWrite && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const detected = detectInclusions({
                        titre: titre,
                        description: description,
                        jourDate: date || null,
                      });
                      saveInclusions(detected);
                      toast.success("Inclusions re-détectées depuis le texte.");
                    }}
                  >
                    ↺ Re-détecter
                  </Button>
                )}
              </div>
              <InclusionToggles inclusions={inclusions} onChange={canWrite ? saveInclusions : () => {}} />
            </div>
          </div>
        </div>
      )}

      {/* MODALE IA "AFFINER" */}
      <AiRefineDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        generating={generating}
        onGenerate={async (extra) => {
          await runGenerate(extra);
          setAiOpen(false);
        }}
      />
    </div>
  );
}

/* ============================================================
 *  Slot d'ajout galerie (déclenche l'ImagePicker dans un Dialog)
 * ============================================================ */
function GalleryAddSlot({
  userId,
  cotationId,
  jourId,
  onAdd,
}: {
  userId: string;
  cotationId: string;
  jourId: string;
  onAdd: (url: string, credit: string | null) => void;
}) {
  const [tempUrl, setTempUrl] = useState<string | null>(null);

  return (
    <div className="aspect-square">
      <ImagePicker
        value={tempUrl}
        onChange={(url, meta) => {
          if (url) {
            onAdd(url, meta?.credit ?? null);
            setTempUrl(null);
          }
        }}
        userId={userId}
        cotationId={cotationId}
        pathPrefix={`jour-${jourId}-gal`}
        buttonLabel="+"
        aspect="square"
      />
    </div>
  );
}

/* ============================================================
 *  Modale "Affiner" (input guidé)
 * ============================================================ */
function AiRefineDialog({
  open,
  onOpenChange,
  generating,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  generating: boolean;
  onGenerate: (extra: { hebergement?: string; activites?: string; ambiance?: string }) => void;
}) {
  const [hebergement, setHebergement] = useState("");
  const [activites, setActivites] = useState("");
  const [ambiance, setAmbiance] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-[color:var(--gold)]" />
            Affiner la génération
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Hébergement</Label>
            <Input
              value={hebergement}
              onChange={(e) => setHebergement(e.target.value)}
              placeholder="ex: Riad Yasmine, en plein cœur de la médina"
            />
          </div>
          <div>
            <Label className="text-xs">Activités prévues</Label>
            <Textarea
              value={activites}
              onChange={(e) => setActivites(e.target.value)}
              placeholder="ex: visite des souks, hammam traditionnel, dîner sur les toits"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-xs">Ambiance / mots-clés</Label>
            <Input
              value={ambiance}
              onChange={(e) => setAmbiance(e.target.value)}
              placeholder="ex: feutré, sensoriel, contemplatif"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>
            Annuler
          </Button>
          <Button
            onClick={() =>
              onGenerate({
                hebergement: hebergement.trim() || undefined,
                activites: activites.trim() || undefined,
                ambiance: ambiance.trim() || undefined,
              })
            }
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Génération…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Générer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Bloc Hôtel d'un jour
 *   - Nom + URL site officiel + URL photo
 *   - Boutons "Rechercher sur Google" (site officiel + images)
 *   - Aperçu photo + lien externe
 * ============================================================ */
function HotelBlock({
  jour,
  canWrite,
  onUpdate,
}: {
  jour: CotationJour;
  canWrite: boolean;
  userId: string;
  cotationId: string;
  onUpdate: (patch: Partial<CotationJour>) => void;
}) {
  const [nom, setNom] = useState(jour.hotel_nom ?? "");
  const [url, setUrl] = useState(jour.hotel_url ?? "");
  const [photo, setPhoto] = useState(jour.hotel_photo_url ?? "");

  useEffect(() => {
    setNom(jour.hotel_nom ?? "");
    setUrl(jour.hotel_url ?? "");
    setPhoto(jour.hotel_photo_url ?? "");
  }, [jour.id, jour.hotel_nom, jour.hotel_url, jour.hotel_photo_url]);

  const queryBase = [nom, jour.lieu].filter(Boolean).join(" ");
  const googleSiteUrl = nom
    ? `https://www.google.com/search?q=${encodeURIComponent(queryBase + " site officiel")}&btnI=1`
    : null;
  const googleImagesUrl = nom
    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(queryBase + " hotel")}`
    : null;

  return (
    <div className="border-t mt-3 pt-3 space-y-2">
      <Label className="text-xs flex items-center gap-1">🏨 Hôtel de la nuit (optionnel)</Label>
      <div className="grid sm:grid-cols-[1fr_auto] gap-2">
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => nom !== (jour.hotel_nom ?? "") && onUpdate({ hotel_nom: nom || null })}
          placeholder="Nom de l'hôtel (ex: Riad Yasmine)"
          disabled={!canWrite}
          className="h-8 text-sm"
        />
        <div className="flex gap-1">
          {googleSiteUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              asChild
              className="h-8"
              title="Aller sur le site officiel via Google"
            >
              <a href={googleSiteUrl} target="_blank" rel="noopener noreferrer">
                Site Google
              </a>
            </Button>
          )}
          {googleImagesUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              asChild
              className="h-8"
              title="Chercher une photo de l'hôtel"
            >
              <a href={googleImagesUrl} target="_blank" rel="noopener noreferrer">
                Photos Google
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => url !== (jour.hotel_url ?? "") && onUpdate({ hotel_url: url || null })}
          placeholder="https://hotel-officiel.com"
          disabled={!canWrite}
          className="h-8 text-sm"
        />
        <Input
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          onBlur={() => photo !== (jour.hotel_photo_url ?? "") && onUpdate({ hotel_photo_url: photo || null })}
          placeholder="URL photo (clic-droit > copier l'image)"
          disabled={!canWrite}
          className="h-8 text-sm"
        />
      </div>
      {(photo || url) && (
        <div className="flex items-center gap-3 pt-1">
          {photo && (
            <a
              href={url || photo}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-24 h-16 rounded overflow-hidden border bg-muted shrink-0"
            >
              <img src={photo} alt={nom || "Hôtel"} className="w-full h-full object-cover" />
            </a>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[color:var(--gold)] hover:underline truncate"
            >
              {url}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
