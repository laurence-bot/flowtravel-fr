// Suivi opérationnel des dossiers : types, helpers, templates par défaut.
import { supabase } from "@/integrations/supabase/client";

export type TaskStatut = "a_faire" | "en_cours" | "termine";
export type TaskPriorite = "normale" | "importante" | "critique";
export type TaskPhase = "avant" | "pre_depart" | "pendant" | "apres" | "autre";

export type DossierTask = {
  id: string;
  user_id: string;
  dossier_id: string;
  phase: TaskPhase;
  type: string | null;
  titre: string;
  description: string | null;
  statut: TaskStatut;
  priorite: TaskPriorite;
  date_echeance: string | null;
  ordre: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUT_LABELS: Record<TaskStatut, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
};

export const PRIORITE_LABELS: Record<TaskPriorite, string> = {
  normale: "Normale",
  importante: "Importante",
  critique: "Critique",
};

export const PHASE_LABELS: Record<TaskPhase, string> = {
  avant: "Avant voyage",
  pre_depart: "Pré-départ",
  pendant: "Pendant le voyage",
  apres: "Après voyage",
  autre: "Autre",
};

export const PHASE_ORDER: TaskPhase[] = ["avant", "pre_depart", "pendant", "apres", "autre"];

export const STATUT_TONE: Record<TaskStatut, string> = {
  a_faire: "bg-secondary text-muted-foreground border-border",
  en_cours: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  termine: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

export const PRIORITE_TONE: Record<TaskPriorite, string> = {
  normale: "bg-secondary text-muted-foreground border-border",
  importante: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  critique: "bg-destructive/15 text-destructive border-destructive/30",
};

const PRIORITE_WEIGHT: Record<TaskPriorite, number> = {
  critique: 0,
  importante: 1,
  normale: 2,
};

export function isEnRetard(t: DossierTask): boolean {
  if (t.statut === "termine") return false;
  if (!t.date_echeance) return false;
  const today = new Date().toISOString().slice(0, 10);
  return t.date_echeance < today;
}

export function isAujourdhui(t: DossierTask): boolean {
  if (t.statut === "termine") return false;
  if (!t.date_echeance) return false;
  const today = new Date().toISOString().slice(0, 10);
  return t.date_echeance === today;
}

/** Tri par urgence : non-terminé d'abord, puis priorité, puis échéance proche, puis ordre. */
export function sortByUrgence(a: DossierTask, b: DossierTask): number {
  const aDone = a.statut === "termine" ? 1 : 0;
  const bDone = b.statut === "termine" ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  const lateA = isEnRetard(a) ? 0 : 1;
  const lateB = isEnRetard(b) ? 0 : 1;
  if (lateA !== lateB) return lateA - lateB;
  const pA = PRIORITE_WEIGHT[a.priorite];
  const pB = PRIORITE_WEIGHT[b.priorite];
  if (pA !== pB) return pA - pB;
  if (a.date_echeance && b.date_echeance) {
    return a.date_echeance.localeCompare(b.date_echeance);
  }
  if (a.date_echeance) return -1;
  if (b.date_echeance) return 1;
  return a.ordre - b.ordre;
}

/** Templates de tâches créés à la naissance d'un dossier. */
export const DEFAULT_TASK_TEMPLATES: Array<{
  phase: TaskPhase;
  titre: string;
  type: string;
  priorite: TaskPriorite;
}> = [
  // Avant voyage
  { phase: "avant", titre: "Vérifier les passeports", type: "passeports", priorite: "importante" },
  { phase: "avant", titre: "Vérifier le permis international", type: "permis", priorite: "normale" },
  { phase: "avant", titre: "Envoyer les documents au client", type: "documents", priorite: "importante" },
  { phase: "avant", titre: "Demander le paiement du solde", type: "solde", priorite: "critique" },
  { phase: "avant", titre: "Réserver les prestations", type: "reservations", priorite: "critique" },
  { phase: "avant", titre: "Vérifier visas et santé", type: "visas_sante", priorite: "importante" },
  // Pré-départ
  { phase: "pre_depart", titre: "Envoyer le carnet de voyage", type: "carnet", priorite: "importante" },
  { phase: "pre_depart", titre: "Vérifier les vols", type: "vols", priorite: "critique" },
  { phase: "pre_depart", titre: "Vérifier les transferts", type: "transferts", priorite: "importante" },
  { phase: "pre_depart", titre: "Envoyer un WhatsApp au client", type: "whatsapp", priorite: "normale" },
  // Pendant
  { phase: "pendant", titre: "Suivi client", type: "suivi", priorite: "normale" },
  { phase: "pendant", titre: "Assistance en cas de problème", type: "assistance", priorite: "importante" },
  // Après
  { phase: "apres", titre: "Appel retour client", type: "retour", priorite: "normale" },
  { phase: "apres", titre: "Demande d'avis", type: "avis", priorite: "normale" },
  { phase: "apres", titre: "Clôture du dossier", type: "cloture", priorite: "importante" },
];

/** Crée la checklist par défaut pour un dossier (idempotent : ne fait rien si déjà des tâches). */
export async function ensureDefaultTasks(userId: string, dossierId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("dossier_tasks")
    .select("id")
    .eq("dossier_id", dossierId)
    .limit(1);
  if (existing && existing.length > 0) return 0;
  const rows = DEFAULT_TASK_TEMPLATES.map((t, i) => ({
    user_id: userId,
    dossier_id: dossierId,
    phase: t.phase,
    type: t.type,
    titre: t.titre,
    priorite: t.priorite,
    statut: "a_faire" as const,
    ordre: i,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("dossier_tasks").insert(rows);
  if (error) return 0;
  return rows.length;
}
