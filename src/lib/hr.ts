import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserSafe, getMyAgenceIdSafe } from "@/lib/auth-cache";

export type ContractType = "cdi" | "cdd" | "stage" | "alternance" | "freelance" | "interim" | "autre";
export type ContractStatut = "brouillon" | "a_signer" | "signe" | "archive" | "rompu";
export type AbsenceType =
  | "conge_paye"
  | "rtt"
  | "maladie"
  | "sans_solde"
  | "formation"
  | "recup"
  | "parental"
  | "autre";
export type AbsenceStatut = "demande" | "approuvee" | "refusee" | "signee" | "annulee";
export type PlanningType =
  | "travail"
  | "teletravail"
  | "reunion"
  | "deplacement"
  | "formation"
  | "recuperation"
  | "remplacement"
  | "autre";
export type TimeEvent = "arrivee" | "pause_debut" | "pause_fin" | "sortie";
export type EvaluationStatut = "a_completer" | "auto_eval_faite" | "entretien_fait" | "signee" | "cloturee";

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  cdi: "CDI",
  cdd: "CDD",
  stage: "Stage",
  alternance: "Alternance",
  freelance: "Freelance",
  interim: "Intérim",
  autre: "Autre",
};
export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  conge_paye: "Congé payé",
  rtt: "RTT",
  maladie: "Maladie",
  sans_solde: "Sans solde",
  formation: "Formation",
  recup: "Récup.",
  parental: "Parental",
  autre: "Autre",
};
export const ABSENCE_STATUT_LABELS: Record<AbsenceStatut, string> = {
  demande: "En attente",
  approuvee: "Approuvée",
  refusee: "Refusée",
  signee: "Signée",
  annulee: "Annulée",
};
export const PLANNING_TYPE_LABELS: Record<PlanningType, string> = {
  travail: "Travail",
  teletravail: "Télétravail",
  reunion: "Réunion",
  deplacement: "Déplacement",
  formation: "Formation",
  recuperation: "Récupération",
  remplacement: "Remplacement",
  autre: "Autre",
};
export const TIME_EVENT_LABELS: Record<TimeEvent, string> = {
  arrivee: "Arrivée",
  pause_debut: "Début pause",
  pause_fin: "Fin pause",
  sortie: "Sortie",
};

export type RythmeType = "fixe" | "ab";

export type Employee = {
  id: string;
  agence_id: string | null;
  user_id: string | null;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  poste: string | null;
  manager_id: string | null;
  date_embauche: string | null;
  date_sortie: string | null;
  type_contrat: ContractType;
  salaire_brut_mensuel: number | null;
  jours_conges_par_an: number;
  jours_rtt_par_an: number;
  notes: string | null;
  actif: boolean;
  created_at: string;
  // Paramètres horaires — optionnels (ajoutés par migration SQL)
  heures_par_jour?: number | null;
  pause_minutes?: number | null;
  rythme_semaine?: RythmeType | null;
  semaine_a_jours?: number[] | null;
  semaine_b_jours?: number[] | null;
  semaine_ref_iso?: number | null;
};

export type Contract = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  titre: string;
  type_contrat: ContractType;
  date_debut: string | null;
  date_fin: string | null;
  pdf_url: string | null;
  contenu_html: string | null;
  statut: ContractStatut;
  token: string;
  expires_at: string;
  signature_data: string | null;
  signataire_nom: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  created_at: string;
};

export type Absence = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  type: AbsenceType;
  date_debut: string;
  date_fin: string;
  demi_journee_debut: boolean;
  demi_journee_fin: boolean;
  nb_jours: number | null;
  motif: string | null;
  justificatif_url: string | null;
  statut: AbsenceStatut;
  approuve_par: string | null;
  approuve_at: string | null;
  motif_refus: string | null;
  token: string;
  expires_at: string;
  signature_data: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  created_at: string;
};

export type PlanningEntry = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  date_start: string;
  date_end: string;
  heure_debut: string | null;
  heure_fin: string | null;
  type: PlanningType;
  note: string | null;
  group_id: string | null;
  pause_minutes?: number | null;
};

/** True if the entry's [date_start, date_end] range covers the given ISO date. */
export function planningEntryCoversDate(e: PlanningEntry, dateIso: string): boolean {
  return e.date_start <= dateIso && dateIso <= e.date_end;
}
/** Expand the entry into the list of ISO dates it covers (inclusive). */
export function planningEntryDays(e: PlanningEntry): string[] {
  const out: string[] = [];
  const end = new Date(`${e.date_end}T00:00:00Z`);
  for (let d = new Date(`${e.date_start}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export type TimeEntry = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  event_type: TimeEvent;
  event_at: string;
  ip_address: string | null;
  user_agent: string | null;
  note: string | null;
};

export type Evaluation = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  annee: number;
  date_entretien: string | null;
  bilan_n_moins_1: string | null;
  atteinte_objectifs: string | null;
  points_forts: string | null;
  axes_progres: string | null;
  formations_souhaitees: string | null;
  objectifs_n_plus_1: string | null;
  evolution_souhaitee: string | null;
  note_globale: number | null;
  auto_evaluation: any;
  evaluation_manager: any;
  evaluateur_id: string | null;
  statut: EvaluationStatut;
  token: string;
  expires_at: string;
  signature_employee: string | null;
  signed_employee_at: string | null;
  signature_manager: string | null;
  signed_manager_at: string | null;
};

export async function getMyAgenceId(): Promise<string | null> {
  return getMyAgenceIdSafe();
}

/** Supprime TOUTES les entrées de planning d'un employé (optionnellement bornées par mois YYYY-MM). */
export async function deleteAllPlanningForEmployee(employeeId: string, opts?: { mois?: string }): Promise<number> {
  let q = supabase.from("hr_planning_entries").delete({ count: "exact" }).eq("employee_id", employeeId);
  if (opts?.mois) {
    const start = `${opts.mois}-01`;
    const [y, m] = opts.mois.split("-").map(Number);
    const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    q = q.gte("date_start", start).lt("date_start", next);
  }
  const { error, count } = await q;
  if (error) throw error;
  return count ?? 0;
}

// =========== Employees ===========
export async function listEmployees(): Promise<Employee[]> {
  // Filtre automatiquement par agence_id du user connecté.
  // Le super_admin (pas d'agence_id) voit tous les employés —
  // la RLS Supabase est la dernière ligne de défense, mais on filtre
  // aussi côté client pour ne jamais croiser les données d'agences.
  const agenceId = await getMyAgenceId();
  let q = supabase.from("hr_employees").select("*").order("nom");
  if (agenceId) q = q.eq("agence_id", agenceId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Employee[];
}
export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase.from("hr_employees").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Employee | null;
}
export async function getEmployeeByUserId(userId: string): Promise<Employee | null> {
  const { data } = await supabase.from("hr_employees").select("*").eq("user_id", userId).maybeSingle();
  return (data ?? null) as Employee | null;
}
export async function createEmployee(input: Partial<Employee>): Promise<Employee> {
  const agence_id = await getMyAgenceId();
  const user = await getCurrentUserSafe();
  const { data, error } = await supabase
    .from("hr_employees")
    .insert({
      agence_id,
      created_by: user?.id ?? null,
      prenom: input.prenom ?? "",
      nom: input.nom ?? "",
      email: input.email ?? null,
      telephone: input.telephone ?? null,
      poste: input.poste ?? null,
      type_contrat: input.type_contrat ?? "cdi",
      date_embauche: input.date_embauche ?? null,
      salaire_brut_mensuel: input.salaire_brut_mensuel ?? null,
      jours_conges_par_an: input.jours_conges_par_an ?? 25,
      jours_rtt_par_an: input.jours_rtt_par_an ?? 0,
      actif: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Employee;
}
export async function updateEmployee(id: string, patch: Partial<Employee>): Promise<void> {
  const { error } = await supabase.from("hr_employees").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("hr_employees").delete().eq("id", id);
  if (error) throw error;
}

// =========== Contracts ===========
export async function listContracts(employeeId?: string): Promise<Contract[]> {
  let q = supabase.from("hr_contracts").select("*").order("created_at", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Contract[];
}
export async function createContract(
  employeeId: string,
  input: { titre: string; type_contrat: ContractType; date_debut?: string; date_fin?: string; contenu_html?: string },
): Promise<Contract> {
  const employee = await getEmployee(employeeId);
  const user = await getCurrentUserSafe();
  const { data, error } = await supabase
    .from("hr_contracts")
    .insert({
      employee_id: employeeId,
      agence_id: employee?.agence_id ?? null,
      titre: input.titre,
      type_contrat: input.type_contrat,
      date_debut: input.date_debut ?? null,
      date_fin: input.date_fin ?? null,
      contenu_html: input.contenu_html ?? null,
      statut: "brouillon",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Contract;
}
export async function sendContractForSignature(id: string): Promise<void> {
  const { error } = await supabase.from("hr_contracts").update({ statut: "a_signer" }).eq("id", id);
  if (error) throw error;
}

// =========== Absences ===========
export async function listAbsences(employeeId?: string, statut?: AbsenceStatut): Promise<Absence[]> {
  let q = supabase.from("hr_absences").select("*").order("date_debut", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (statut) q = q.eq("statut", statut);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Absence[];
}
export async function createAbsence(input: {
  employee_id: string;
  type: AbsenceType;
  date_debut: string;
  date_fin: string;
  motif?: string;
}): Promise<Absence> {
  const employee = await getEmployee(input.employee_id);
  const user = await getCurrentUserSafe();
  const nbJours = computeWorkingDays(input.date_debut, input.date_fin);
  const { data, error } = await supabase
    .from("hr_absences")
    .insert({
      employee_id: input.employee_id,
      agence_id: employee?.agence_id ?? null,
      type: input.type,
      date_debut: input.date_debut,
      date_fin: input.date_fin,
      nb_jours: nbJours,
      motif: input.motif ?? null,
      statut: "demande",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Absence;
}
export async function approveAbsence(id: string): Promise<void> {
  const user = await getCurrentUserSafe();
  const { error } = await supabase
    .from("hr_absences")
    .update({
      statut: "approuvee",
      approuve_par: user?.id ?? null,
      approuve_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  // Bloquer les jours dans le planning pour que l'absence soit visible
  // dans le calendrier et prise en compte dans les conflits.
  try {
    const { data: absence } = await supabase.from("hr_absences").select("*").eq("id", id).maybeSingle();
    const a = absence as any;
    if (a) {
      const employee = await getEmployee(a.employee_id);
      const year = Number(a.date_debut.slice(0, 4));
      const holidays = frenchHolidays(year);
      // Itérer sur chaque jour ouvré de la plage
      const start = new Date(a.date_debut);
      const end = new Date(a.date_fin);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        if (!isJourOuvre(iso, holidays)) continue;
        // Supprimer les entrées de travail existantes sur ce jour (éviter conflits)
        await supabase
          .from("hr_planning_entries")
          .delete()
          .eq("employee_id", a.employee_id)
          .eq("date_start", iso)
          .in("type", ["travail", "teletravail"]);
        // Créer une entrée "recup" ou le type d'absence approprié dans le planning
        // On mappe AbsenceType → PlanningType pour visualisation
        const planningType = a.type === "recup" ? "recuperation" : "autre";
        await (supabase.from("hr_planning_entries") as any).insert({
          employee_id: a.employee_id,
          agence_id: employee?.agence_id ?? null,
          date_start: iso,
          date_end: iso,
          type: planningType,
          note: `Absence : ${a.type}${a.motif ? " — " + a.motif : ""}`,
          created_by: user?.id ?? null,
        });
      }
    }
  } catch (e) {
    // Non bloquant : le statut est déjà mis à jour
    console.warn("approveAbsence: planning sync failed", e);
  }
}
export async function rejectAbsence(id: string, motif: string): Promise<void> {
  const user = await getCurrentUserSafe();
  const { error } = await supabase
    .from("hr_absences")
    .update({
      statut: "refusee",
      approuve_par: user?.id ?? null,
      approuve_at: new Date().toISOString(),
      motif_refus: motif,
    })
    .eq("id", id);
  if (error) throw error;
}

export function computeWorkingDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  // Calcule les jours fériés pour toutes les années couvertes par la plage
  const years = new Set<number>();
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    years.add(d.getFullYear());
  }
  const holidays = new Set<string>();
  years.forEach((y) => frenchHolidays(y).forEach((h) => holidays.add(h)));
  let n = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (isJourOuvre(iso, holidays)) n++;
  }
  return n;
}

// =========== Time entries (pointage) ===========
export async function listTimeEntries(employeeId: string, fromIso?: string, toIso?: string): Promise<TimeEntry[]> {
  let q = supabase
    .from("hr_time_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .order("event_at", { ascending: false });
  if (fromIso) q = q.gte("event_at", fromIso);
  if (toIso) q = q.lte("event_at", toIso);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}
export async function pointer(employeeId: string, event: TimeEvent, note?: string): Promise<void> {
  const employee = await getEmployee(employeeId);
  const { error } = await supabase.from("hr_time_entries").insert({
    employee_id: employeeId,
    agence_id: employee?.agence_id ?? null,
    event_type: event,
    event_at: new Date().toISOString(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    note: note ?? null,
  });
  if (error) throw error;
}
export async function listTimeEntriesAgence(fromIso: string, toIso: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("hr_time_entries")
    .select("*")
    .gte("event_at", fromIso)
    .lte("event_at", toIso)
    .order("event_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

// =========== Planning ===========
/**
 * Liste les entrées planning dont la plage [date_start, date_end] chevauche la
 * période [fromIso, toIso]. Une entrée multi-mois apparaît dans tous les mois
 * concernés.
 */
export async function listPlanning(fromIso: string, toIso: string): Promise<PlanningEntry[]> {
  const { data, error } = await supabase
    .from("hr_planning_entries")
    .select("*")
    .lte("date_start", toIso)
    .gte("date_end", fromIso)
    .order("date_start");
  if (error) throw error;
  return (data ?? []) as unknown as PlanningEntry[];
}
export async function upsertPlanning(
  input: Partial<PlanningEntry> & { employee_id: string; date_start: string; type: PlanningType; date_end?: string },
): Promise<void> {
  const employee = await getEmployee(input.employee_id);
  const user = await getCurrentUserSafe();
  const { error } = await supabase.from("hr_planning_entries").insert({
    employee_id: input.employee_id,
    agence_id: employee?.agence_id ?? null,
    date_start: input.date_start,
    date_end: input.date_end ?? input.date_start,
    type: input.type,
    heure_debut: input.heure_debut ?? null,
    heure_fin: input.heure_fin ?? null,
    note: input.note ?? null,
    created_by: user?.id ?? null,
    group_id: (input as any).group_id ?? null,
    pause_minutes: (input as any).pause_minutes ?? null,
  } as any);
  if (error) throw error;
}
export async function deletePlanning(id: string): Promise<void> {
  const { error } = await supabase.from("hr_planning_entries").delete().eq("id", id);
  if (error) throw error;
}
export async function deletePlanningGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from("hr_planning_entries").delete().eq("group_id", groupId);
  if (error) throw error;
}

/** Supprime une absence (RH). */
export async function deleteAbsence(id: string): Promise<void> {
  const { error } = await supabase.from("hr_absences").delete().eq("id", id);
  if (error) throw error;
}
export async function listAllTimeEntries(fromIso: string, toIso: string): Promise<TimeEntry[]> {
  return listTimeEntriesAgence(fromIso, toIso);
}

/** Calcule les heures pointées d'un employé un jour donné (paire arrivée→sortie). */
export function calcHeuresPointees(entries: TimeEntry[]): number {
  const sorted = [...entries].sort((a, b) => a.event_at.localeCompare(b.event_at));
  let total = 0;
  let arrivee: number | null = null;
  let pauseStart: number | null = null;
  let pauseTotal = 0;
  for (const e of sorted) {
    const t = new Date(e.event_at).getTime();
    if (e.event_type === "arrivee") arrivee = t;
    else if (e.event_type === "pause_debut") pauseStart = t;
    else if (e.event_type === "pause_fin" && pauseStart != null) {
      pauseTotal += t - pauseStart;
      pauseStart = null;
    } else if (e.event_type === "sortie" && arrivee != null) {
      total += t - arrivee - pauseTotal;
      arrivee = null;
      pauseTotal = 0;
      pauseStart = null;
    }
  }
  return Math.round((total / 3600000) * 100) / 100;
}

// =========== Evaluations ===========
export async function listEvaluations(employeeId?: string): Promise<Evaluation[]> {
  let q = supabase.from("hr_evaluations").select("*").order("annee", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Evaluation[];
}
export async function createEvaluation(employeeId: string, annee: number): Promise<Evaluation> {
  const employee = await getEmployee(employeeId);
  const user = await getCurrentUserSafe();
  const { data, error } = await supabase
    .from("hr_evaluations")
    .insert({
      employee_id: employeeId,
      agence_id: employee?.agence_id ?? null,
      annee,
      statut: "a_completer",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Evaluation;
}
export async function updateEvaluation(id: string, patch: Partial<Evaluation>): Promise<void> {
  const { error } = await supabase.from("hr_evaluations").update(patch).eq("id", id);
  if (error) throw error;
}

// =========== Settings ===========
export type HrSettings = {
  id: string;
  agence_id: string | null;
  email_comptable: string | null;
  email_comptable_cc: string | null;
  jour_envoi_recap: number;
  derniere_execution_at: string | null;
};
export async function getHrSettings(): Promise<HrSettings | null> {
  const agence_id = await getMyAgenceId();
  if (!agence_id) return null;
  const { data } = await supabase.from("hr_settings").select("*").eq("agence_id", agence_id).maybeSingle();
  return (data ?? null) as HrSettings | null;
}
export async function upsertHrSettings(patch: Partial<HrSettings>): Promise<void> {
  const agence_id = await getMyAgenceId();
  const { error } = await supabase.from("hr_settings").upsert({ agence_id, ...patch }, { onConflict: "agence_id" });
  if (error) throw error;
}

// =========== Job Descriptions ===========
export type JobDescription = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  intitule: string;
  missions: string | null;
  competences_attendues: string | null;
  objectifs: string | null;
  kpi: string | null;
  date_application: string | null;
  version: number;
  est_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listJobDescriptions(employeeId?: string): Promise<JobDescription[]> {
  let q = supabase.from("hr_job_descriptions").select("*").order("created_at", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as JobDescription[];
}

export async function createJobDescription(
  input: Partial<JobDescription> & { employee_id: string; intitule: string },
): Promise<JobDescription> {
  const agence_id = await getMyAgenceId();
  const user = await getCurrentUserSafe();
  // Désactiver les anciennes versions actives pour cet employé
  await supabase
    .from("hr_job_descriptions")
    .update({ est_active: false })
    .eq("employee_id", input.employee_id)
    .eq("est_active", true);
  // Trouver la prochaine version
  const { data: prev } = await supabase
    .from("hr_job_descriptions")
    .select("version")
    .eq("employee_id", input.employee_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((prev as any)?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("hr_job_descriptions")
    .insert({
      agence_id,
      created_by: user?.id ?? null,
      est_active: true,
      version: nextVersion,
      employee_id: input.employee_id,
      intitule: input.intitule,
      missions: input.missions ?? null,
      competences_attendues: input.competences_attendues ?? null,
      objectifs: input.objectifs ?? null,
      kpi: input.kpi ?? null,
      date_application: input.date_application ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as JobDescription;
}

export async function updateJobDescription(id: string, patch: Partial<JobDescription>): Promise<void> {
  const { error } = await supabase.from("hr_job_descriptions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteJobDescription(id: string): Promise<void> {
  const { error } = await supabase.from("hr_job_descriptions").delete().eq("id", id);
  if (error) throw error;
}

// =========== Compteur d'heures ===========

export type CompteurHeures = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  mois: string;
  heures_contractuelles: number;
  heures_realisees: number;
  heures_report: number;
  solde: number;
  created_at: string;
  updated_at: string;
};

export type RecupDemande = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  mois: string;
  type: "journee" | "heures" | "report_exceptionnel";
  heures_demandees: number;
  date_souhaitee: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  motif: string | null;
  statut: "demande" | "approuvee" | "refusee" | "annulee";
  traite_par: string | null;
  traite_at: string | null;
  planning_entry_id: string | null;
  created_at: string;
};

// Déplacement et formation = présence normale, heures contractuelles habituelles.
// Le type "déplacement" indique seulement que l'employé n'est pas à l'agence.

/** Calcule les jours fériés français pour une année donnée (date YYYY-MM-DD). */
export function frenchHolidays(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-08`,
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ];
  // Pâques (algorithme de Meeus/Jones/Butcher)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(Date.UTC(year, month - 1, day));
  const addDays = (n: number) => {
    const d = new Date(easter);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  // Lundi de Pentecôte = journée de solidarité depuis 2004 → travaillé, non chômé
  return new Set([...fixed, addDays(1), addDays(39)]); // Lundi de Pâques, Ascension uniquement
}

export function isJourFerie(dateIso: string, holidays?: Set<string>): boolean {
  const set = holidays ?? frenchHolidays(Number(dateIso.slice(0, 4)));
  return set.has(dateIso);
}

export function isJourOuvre(dateIso: string, holidays?: Set<string>): boolean {
  const day = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  if (day === 0) return false; // dimanche uniquement — le samedi est ouvré
  return !isJourFerie(dateIso, holidays);
}

function daysInIsoMonth(month: string): string[] {
  const start = new Date(`${month}-01T00:00:00Z`);
  const out: string[] = [];
  for (let d = new Date(start); d.getUTCMonth() === start.getUTCMonth(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Heures contractuelles par jour — lit depuis l'employé, sinon 7.5h. */
export function heuresContractuellesParJour(
  emp?: (Pick<Employee, "type_contrat"> & { heures_par_jour?: number | null }) | null,
): number {
  return emp?.heures_par_jour ?? 7.5;
}

/** Nombre de jours travaillés/semaine selon le rythme (A ou A/B moyenné). */
export function joursParSemaineEmp(emp?: Employee | null): number {
  if (!emp) return 5;
  const a = emp.semaine_a_jours?.length ?? 5;
  if (emp.rythme_semaine === "ab") {
    const b = emp.semaine_b_jours?.length ?? a;
    return (a + b) / 2;
  }
  return a;
}

/**
 * Base mensualisée AFFICHÉE SUR LE BULLETIN DE PAIE.
 * Si l'employé bénéficie d'un accord RTT (jours_rtt_par_an > 0) :
 *   base paie = 35h × (joursParSemaine / 5) × 52 / 12  → 151,67h pour un temps plein 5j
 * Sinon, identique à la base contractuelle réelle.
 *
 * IMPORTANT — ne sert QU'À l'affichage paie. Les alertes et le suivi des
 * heures sup s'appuient sur la base contractuelle réelle (heures_par_jour),
 * jamais sur cette base paie.
 */
export function basePaieMensuelle(emp: Employee): number {
  const jps = joursParSemaineEmp(emp);
  const hParJour = heuresContractuellesParJour(emp);
  const baseContrat = (jps * hParJour * 52) / 12;
  if ((emp.jours_rtt_par_an ?? 0) > 0) {
    const basePaie = (35 * (jps / 5) * 52) / 12;
    return Math.round(basePaie * 100) / 100;
  }
  return Math.round(baseContrat * 100) / 100;
}

/** Retourne true si la date est un jour travaillé selon le rythme A/B de l'employé. */
export function estJourTravaille(emp: Employee, dateIso: string): boolean {
  const dow = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  if (dow === 0) return false;
  if (!emp.rythme_semaine || emp.rythme_semaine === "fixe") {
    return (emp.semaine_a_jours ?? [1, 2, 3, 4, 5]).includes(dow);
  }
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const isoW = 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
  const ref = emp.semaine_ref_iso ?? 1;
  const isA = (((isoW - ref) % 2) + 2) % 2 === 0;
  return (isA ? (emp.semaine_a_jours ?? [1, 2, 3, 4, 5, 6]) : (emp.semaine_b_jours ?? [1, 2, 4, 5])).includes(dow);
}

function dureeNetteEntry(e: PlanningEntry): number {
  if (!e.heure_debut || !e.heure_fin) return 0;
  const [dh, dm] = e.heure_debut.split(":").map(Number);
  const [fh, fm] = e.heure_fin.split(":").map(Number);
  const dureeMin = fh * 60 + fm - (dh * 60 + dm);
  let pauseMin = (e as any).pause_minutes;
  // Si pause non saisie OU saisie à 0 sur une journée > 6h → pause repas par défaut 30 min
  if (pauseMin == null) pauseMin = dureeMin > 360 ? 30 : 0;
  else if (pauseMin === 0 && dureeMin > 360) pauseMin = 30;
  return Math.max(0, dureeMin - pauseMin) / 60;
}

/**
 * Compteur mensuel FlowTravel — logique RH par exception.
 *
 * IMPORTANT METIER :
 * Le planning ne sert pas à prouver que l'employé a travaillé chaque jour.
 * Un mois normal, sans saisie particulière, vaut 0h de solde.
 *
 * Le compteur calcule uniquement l'impact sur le compteur :
 * - travail / télétravail / réunion : impact = durée nette saisie - forfait du jour
 *   sur un jour normalement travaillé ; sur un jour non travaillé, la durée saisie
 *   devient une heure supplémentaire explicite.
 * - déplacement / formation : visible dans le calendrier, assimilé travail, mais
 *   neutralisé dans le compteur. Crédit métier max 7h/jour, jamais d'heure sup,
 *   jamais d'impact négatif, même sur une plage longue.
 * - récupération : retire les heures posées du compteur.
 * - jours fériés / absences neutralisées : ne sont PAS des heures réalisées ; ils
 *   neutralisent seulement la base attendue et ne créent aucun impact.
 *
 * Résultat :
 * - planning vide = solde 0h ;
 * - jours fériés = 0h affichées dans l'impact, pas +22,5h ;
 * - déplacement / formation = visible, mais solde inchangé ;
 * - seules les heures sup explicites et les récupérations modifient le solde.
 */
export function calcCompteurMensuel(
  entries: PlanningEntry[],
  joursOuvres: string[],
  heuresParJour: number = 7.5,
  emp?: Employee,
  _baseMensuelleFixe?: number,
  _joursNeutralises: string[] = [],
): {
  base: number;
  travailReel: number;
  depForm: number;
  realisees: number;
  solde: number;
  heuresSup: number;
  rttAcquises: number;
  heuresRecup: number;
  joursRythme: number;
} {
  const joursRythme = emp ? joursOuvres.filter((d) => estJourTravaille(emp, d)) : joursOuvres;
  const rythmeSet = new Set(joursRythme);
  const joursOuvresSet = new Set(joursOuvres);
  const base = joursRythme.length * heuresParJour;
  const hasRttAgreement = (emp?.jours_rtt_par_an ?? 0) > 0;
  const basePaieJour = hasRttAgreement ? 7 : heuresParJour;

  let impact = 0;
  let heuresSup = 0;
  let rttAcquises = 0;
  let heuresRecup = 0;
  let travailSaisi = 0;
  let depFormNeutralise = 0;

  const round = (n: number) => Math.round(n * 100) / 100;

  for (const e of entries) {
    const days = planningEntryDays(e);
    const isRange = days.length > 1;
    const duree = dureeNetteEntry(e);

    if (e.type === "recuperation") {
      const explicit = Number((e as any).heures_recup ?? 0);
      const fallback = duree > 0 ? duree : heuresParJour;
      const value = Math.min(heuresParJour, explicit > 0 ? explicit : fallback);

      for (const d of days) {
        if (!joursOuvresSet.has(d)) continue;
        if (!rythmeSet.has(d) && isRange) continue;
        heuresRecup += value;
      }
      continue;
    }

    if (e.type === "remplacement") continue;

    if (e.type === "deplacement" || e.type === "formation") {
      for (const d of days) {
        if (!joursOuvresSet.has(d)) continue;
        if (!rythmeSet.has(d)) continue;
        // Déplacement / formation : visible au calendrier, assimilé travail,
        // mais 7h max/jour, sans RTT acquise et sans heure supplémentaire.
        const credited = Math.min(7, duree > 0 ? duree : 7);
        depFormNeutralise += credited;
      }
      continue;
    }

    if (!["travail", "teletravail", "reunion"].includes(e.type)) continue;

    for (const d of days) {
      if (!joursOuvresSet.has(d)) continue;
      const isNormalWorkedDay = rythmeSet.has(d);

      // Une plage longue de travail sert à poser un planning-type : elle ne doit
      // pas générer d'heures sur les jours habituellement non travaillés.
      if (isRange && !isNormalWorkedDay) continue;

      const effective = duree > 0 ? duree : isNormalWorkedDay ? heuresParJour : 0;
      if (effective <= 0) continue;

      travailSaisi += effective;

      let dayImpact = 0;
      if (isNormalWorkedDay) {
        if (hasRttAgreement) {
          // Exemple Lisa : journée saisie 7h30 = 7h payées + 0h30 RTT acquise.
          // Les heures au-delà du contrat journalier restent des heures en plus.
          const rttCredit = Math.max(0, Math.min(effective, heuresParJour) - basePaieJour);
          const overtimeBeyondContract = Math.max(0, effective - heuresParJour);
          rttAcquises += rttCredit;
          // Le crédit RTT journalier (0h30 entre base de paie 7h et contrat 7h30)
          // alimente le solde = heures à rattraper. Seules les heures au-delà du
          // contrat journalier sont en plus comptées comme heures sup.
          dayImpact = effective < heuresParJour
            ? effective - heuresParJour
            : rttCredit + overtimeBeyondContract;
        } else {
          dayImpact = effective - heuresParJour;
        }
      } else {
        // Travail explicite sur jour habituellement non travaillé : heures en plus.
        dayImpact = effective;
      }

      impact += dayImpact;
      if (dayImpact > 0) heuresSup += dayImpact;
    }
  }

  impact -= heuresRecup;

  return {
    base: round(base),
    travailReel: round(travailSaisi),
    depForm: round(depFormNeutralise),
    realisees: round(impact),
    solde: round(impact),
    heuresSup: round(heuresSup),
    rttAcquises: round(rttAcquises),
    heuresRecup: round(heuresRecup),
    joursRythme: joursRythme.length,
  };
}

export function calcHeuresRealisees(entries: PlanningEntry[], heuresParJour = 7.5): number {
  let total = 0;
  for (const e of entries) {
    const days = planningEntryDays(e);
    const duree = dureeNetteEntry(e);
    if (["travail", "teletravail", "reunion"].includes(e.type)) {
      total += (duree > 0 ? duree : heuresParJour) * days.length;
    } else if (e.type === "deplacement" || e.type === "formation") {
      total += Math.min(7, duree > 0 ? duree : 7) * days.length;
    }
  }
  return Math.round(total * 100) / 100;
}

/** Heures effectives uniquement (travail/teletravail/reunion). */
export function calcHeuresEffectives(entries: PlanningEntry[]): number {
  return calcHeuresRealisees(
    entries.filter((e) => e.type === "travail" || e.type === "teletravail" || e.type === "reunion"),
  );
}

export async function getCompteur(employeeId: string, mois: string): Promise<CompteurHeures | null> {
  const { data } = await supabase
    .from("hr_compteur_heures" as any)
    .select("*")
    .eq("employee_id", employeeId)
    .eq("mois", mois)
    .maybeSingle();
  if (!data) return null;
  const d: any = data;
  return { ...d, solde: d.heures_realisees + d.heures_report } as CompteurHeures;
}

export async function upsertCompteur(
  employeeId: string,
  mois: string,
  heuresRealisees: number,
  heuresContractuelles: number,
): Promise<void> {
  const agence_id = await getMyAgenceId();
  const { error } = await supabase.from("hr_compteur_heures" as any).upsert(
    {
      employee_id: employeeId,
      agence_id,
      mois,
      heures_realisees: heuresRealisees,
      heures_contractuelles: heuresContractuelles,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,mois" },
  );
  if (error) throw error;
}

/** Supprime tous les compteurs stockés pour un mois — force un recalcul propre. */
export async function clearCompteursMois(mois: string): Promise<void> {
  const { error } = await supabase
    .from("hr_compteur_heures" as any)
    .delete()
    .eq("mois", mois);
  if (error) throw error;
}

export async function listCompteurs(mois: string): Promise<CompteurHeures[]> {
  const { data, error } = await supabase
    .from("hr_compteur_heures" as any)
    .select("*")
    .eq("mois", mois);
  if (error) throw error;
  return ((data ?? []) as any[]).map((d) => ({
    ...d,
    solde: d.heures_realisees + d.heures_report,
  }));
}

export async function listRecupDemandes(mois?: string): Promise<RecupDemande[]> {
  let q = supabase
    .from("hr_recup_demandes" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (mois) q = q.eq("mois", mois);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as RecupDemande[];
}

export async function createRecupDemande(input: {
  employee_id: string;
  mois: string;
  type: RecupDemande["type"];
  heures_demandees: number;
  date_souhaitee?: string;
  heure_debut?: string;
  heure_fin?: string;
  motif?: string;
}): Promise<RecupDemande> {
  const agence_id = await getMyAgenceId();
  const { data, error } = await supabase
    .from("hr_recup_demandes" as any)
    .insert({
      employee_id: input.employee_id,
      agence_id,
      mois: input.mois,
      type: input.type,
      heures_demandees: input.heures_demandees,
      date_souhaitee: input.date_souhaitee ?? null,
      heure_debut: input.heure_debut ?? null,
      heure_fin: input.heure_fin ?? null,
      motif: input.motif ?? null,
      statut: "demande",
    })
    .select("*")
    .single();
  if (error) throw error;

  // Notifier les admins de l'agence
  try {
    const { data: emp } = await supabase
      .from("hr_employees")
      .select("prenom,nom")
      .eq("id", input.employee_id)
      .maybeSingle();
    const nomAgent = emp ? `${emp.prenom ?? ""} ${emp.nom ?? ""}`.trim() : "un agent";

    if (agence_id) {
      const { data: admins } = await supabase
        .from("user_profiles")
        .select("user_id, user_roles!inner(role)")
        .eq("agence_id", agence_id)
        .eq("user_roles.role", "administrateur" as any);
      const adminIds = (admins ?? []).map((a: any) => a.user_id).filter(Boolean);
      if (adminIds.length > 0) {
        await supabase.from("agent_notifications").insert(
          adminIds.map((uid: string) => ({
            user_id: uid,
            agence_id,
            type: "recup_demande",
            titre: "Nouvelle demande de récupération",
            message: `Nouvelle demande de récupération de ${nomAgent}`,
            link: "/ops/equipe/absences",
          })),
        );
      }
    }
  } catch (e) {
    console.warn("notify admin recup_demande failed", e);
  }

  return data as unknown as RecupDemande;
}

export async function approuverRecupDemande(id: string): Promise<void> {
  const user = await getCurrentUserSafe();
  // Charger la demande pour récupérer date/heures
  const { data: dem, error: e1 } = await supabase
    .from("hr_recup_demandes" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (e1) throw e1;
  const d = dem as any;
  if (!d) throw new Error("Demande introuvable");

  let planning_entry_id: string | null = d.planning_entry_id ?? null;
  if (d.date_souhaitee) {
    const employee = await getEmployee(d.employee_id);
    if (planning_entry_id) {
      await supabase
        .from("hr_planning_entries")
        .delete()
        .eq("employee_id", d.employee_id)
        .eq("date_start", d.date_souhaitee)
        .eq("date_end", d.date_souhaitee)
        .eq("type", "recuperation")
        .neq("id", planning_entry_id);
      const { error: updatePlanningError } = await supabase
        .from("hr_planning_entries")
        .update({
          heure_debut: d.heure_debut ?? null,
          heure_fin: d.heure_fin ?? null,
          note: d.motif ?? "Récupération",
        } as any)
        .eq("id", planning_entry_id);
      if (updatePlanningError) throw updatePlanningError;
    } else {
      await supabase
        .from("hr_planning_entries")
        .delete()
        .eq("employee_id", d.employee_id)
        .eq("date_start", d.date_souhaitee)
        .eq("date_end", d.date_souhaitee)
        .eq("type", "recuperation");
      const { data: ins, error: e2 } = await supabase
        .from("hr_planning_entries")
        .insert({
          employee_id: d.employee_id,
          agence_id: employee?.agence_id ?? null,
          date_start: d.date_souhaitee,
          date_end: d.date_souhaitee,
          type: "recuperation",
          heure_debut: d.heure_debut ?? null,
          heure_fin: d.heure_fin ?? null,
          note: d.motif ?? "Récupération",
          created_by: user?.id ?? null,
        } as any)
        .select("id")
        .single();
      if (e2) throw e2;
      planning_entry_id = (ins as any)?.id ?? null;
    }
  }

  const { error } = await supabase
    .from("hr_recup_demandes" as any)
    .update({
      statut: "approuvee",
      traite_par: user?.id ?? null,
      traite_at: new Date().toISOString(),
      planning_entry_id,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function refuserRecupDemande(id: string): Promise<void> {
  const user = await getCurrentUserSafe();
  const { error } = await supabase
    .from("hr_recup_demandes" as any)
    .update({ statut: "refusee", traite_par: user?.id ?? null, traite_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function annulerRecupDemande(id: string): Promise<void> {
  const { error } = await supabase
    .from("hr_recup_demandes" as any)
    .update({ statut: "annulee" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRecupDemande(id: string): Promise<void> {
  // 1. Supprimer l'entrée planning liée si présente.
  //    La FK ON DELETE SET NULL + trigger DB remet automatiquement
  //    le statut à "demande" — pas besoin de le faire côté JS.
  const { data: dem } = await supabase
    .from("hr_recup_demandes" as any)
    .select("planning_entry_id")
    .eq("id", id)
    .maybeSingle();
  const peId = (dem as any)?.planning_entry_id;
  if (peId) {
    await supabase.from("hr_planning_entries").delete().eq("id", peId);
    // Attendre que la FK ON DELETE SET NULL soit propagée avant la suppression
    await new Promise((r) => setTimeout(r, 100));
  }
  // 2. Supprimer la demande elle-même
  const { error } = await supabase
    .from("hr_recup_demandes" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Détache une entrée planning d'une récup sans supprimer la demande.
 *  Le trigger DB remet automatiquement le statut à "demande". */
export async function detachPlanningFromRecup(recupId: string): Promise<void> {
  const { error } = await supabase
    .from("hr_recup_demandes" as any)
    .update({ planning_entry_id: null })
    .eq("id", recupId);
  if (error) throw error;
}

export function alertesFinDeMois(
  compteurs: CompteurHeures[],
  employees: Employee[],
): { employee: Employee; solde: number }[] {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = Math.ceil((endOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 5) return [];
  return compteurs
    .filter((c) => c.solde > 0)
    .map((c) => ({
      employee: employees.find((e) => e.id === c.employee_id)!,
      solde: c.solde,
    }))
    .filter((x) => x.employee);
}

// =========== Documents RH ===========

export type DocCategorie =
  | "contrat"
  | "avenant"
  | "deplacement"
  | "formation"
  | "evaluation"
  | "disciplinaire"
  | "medical"
  | "administratif"
  | "autre";

export const DOC_CATEGORIE_LABELS: Record<DocCategorie, string> = {
  contrat: "Contrat de travail",
  avenant: "Avenant",
  deplacement: "Note de déplacement",
  formation: "Formation",
  evaluation: "Évaluation",
  disciplinaire: "Document disciplinaire",
  medical: "Document médical",
  administratif: "Administratif",
  autre: "Autre",
};

export const DOC_CATEGORIE_ICONS: Record<DocCategorie, string> = {
  contrat: "📄",
  avenant: "📝",
  deplacement: "✈️",
  formation: "🎓",
  evaluation: "⭐",
  disciplinaire: "⚠️",
  medical: "🏥",
  administratif: "📋",
  autre: "📁",
};

export type HrDocument = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  categorie: DocCategorie;
  titre: string;
  description: string | null;
  pdf_url: string | null;
  date_document: string | null;
  necessite_signature: boolean;
  statut: "brouillon" | "a_signer" | "signe" | "archive";
  token: string;
  signed_at: string | null;
  signataire_nom: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listHrDocuments(employeeId?: string, categorie?: DocCategorie): Promise<HrDocument[]> {
  let q = supabase
    .from("hr_documents" as any)
    .select("*")
    .order("date_document", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (categorie) q = q.eq("categorie", categorie);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as HrDocument[];
}

export async function createHrDocument(input: {
  employee_id: string;
  categorie: DocCategorie;
  titre: string;
  description?: string;
  date_document?: string;
  necessite_signature?: boolean;
}): Promise<HrDocument> {
  const agence_id = await getMyAgenceId();
  const user = await getCurrentUserSafe();
  const { data, error } = await supabase
    .from("hr_documents" as any)
    .insert({
      employee_id: input.employee_id,
      agence_id,
      categorie: input.categorie,
      titre: input.titre,
      description: input.description ?? null,
      date_document: input.date_document ?? null,
      necessite_signature: input.necessite_signature ?? false,
      statut: "brouillon",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as HrDocument;
}

export async function updateHrDocument(id: string, patch: Partial<HrDocument>): Promise<void> {
  const { error } = await supabase
    .from("hr_documents" as any)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteHrDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from("hr_documents" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function uploadHrDocumentPdf(file: File, docId: string): Promise<string> {
  const path = `hr-docs/${docId}/document.pdf`;
  const { error } = await supabase.storage
    .from("hr-documents")
    .upload(path, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw new Error(`Upload échoué : ${error.message}`);
  const { data } = supabase.storage.from("hr-documents").getPublicUrl(path);
  return data.publicUrl;
}

// =========== Jours dus / rendus ===========
export type JoursDuSens = "du" | "rendu";
export type JoursDuStatut = "ouvert" | "solde" | "annule";

export type JourDu = {
  id: string;
  employee_id: string;
  agence_id: string | null;
  sens: JoursDuSens;
  date_origine: string;
  motif: string | null;
  planning_entry_id: string | null;
  date_extinction: string | null;
  extinction_entry_id: string | null;
  statut: JoursDuStatut;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export async function listJoursDus(employeeId?: string): Promise<JourDu[]> {
  let q = supabase
    .from("hr_jours_dus" as any)
    .select("*")
    .order("date_origine", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as JourDu[];
}

export async function createJourDu(input: {
  employee_id: string;
  sens: JoursDuSens;
  date_origine: string;
  motif?: string;
  note?: string;
}): Promise<void> {
  const employee = await getEmployee(input.employee_id);
  const { error } = await supabase.from("hr_jours_dus" as any).insert({
    employee_id: input.employee_id,
    agence_id: employee?.agence_id ?? null,
    sens: input.sens,
    date_origine: input.date_origine,
    motif: input.motif ?? null,
    note: input.note ?? null,
    statut: "ouvert",
  } as any);
  if (error) throw error;
}

export async function marquerJourDuSolde(id: string): Promise<void> {
  const { error } = await supabase
    .from("hr_jours_dus" as any)
    .update({ statut: "solde", date_extinction: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) throw error;
}

export async function annulerJourDu(id: string): Promise<void> {
  const { error } = await supabase
    .from("hr_jours_dus" as any)
    .update({ statut: "annule" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteJourDu(id: string): Promise<void> {
  const { error } = await supabase
    .from("hr_jours_dus" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Réinitialise toutes les données RH d'un employé sans supprimer sa fiche.
 * Purge : planning, pointage, absences, récup, contrats, évals, fiches poste,
 * documents, compteurs et jours dus/rendus.
 */
export async function resetEmployeeData(employeeId: string): Promise<void> {
  const tables = [
    "hr_jours_dus",
    "hr_compteur_heures",
    "hr_planning_entries",
    "hr_time_entries",
    "hr_absences",
    "hr_recup_demandes",
    "hr_contracts",
    "hr_evaluations",
    "hr_job_descriptions",
    "hr_documents",
  ] as const;
  for (const t of tables) {
    const { error } = await supabase
      .from(t as any)
      .delete()
      .eq("employee_id", employeeId);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
}
