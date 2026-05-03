import { supabase } from "@/integrations/supabase/client";

export type ContractType = "cdi" | "cdd" | "stage" | "alternance" | "freelance" | "interim" | "autre";
export type ContractStatut = "brouillon" | "a_signer" | "signe" | "archive" | "rompu";
export type AbsenceType = "conge_paye" | "rtt" | "maladie" | "sans_solde" | "formation" | "recup" | "parental" | "autre";
export type AbsenceStatut = "demande" | "approuvee" | "refusee" | "signee" | "annulee";
export type PlanningType = "travail" | "teletravail" | "reunion" | "deplacement" | "formation" | "autre";
export type TimeEvent = "arrivee" | "pause_debut" | "pause_fin" | "sortie";
export type EvaluationStatut = "a_completer" | "auto_eval_faite" | "entretien_fait" | "signee" | "cloturee";

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  cdi: "CDI", cdd: "CDD", stage: "Stage", alternance: "Alternance", freelance: "Freelance", interim: "Intérim", autre: "Autre",
};
export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  conge_paye: "Congé payé", rtt: "RTT", maladie: "Maladie", sans_solde: "Sans solde",
  formation: "Formation", recup: "Récup.", parental: "Parental", autre: "Autre",
};
export const ABSENCE_STATUT_LABELS: Record<AbsenceStatut, string> = {
  demande: "En attente", approuvee: "Approuvée", refusee: "Refusée", signee: "Signée", annulee: "Annulée",
};
export const PLANNING_TYPE_LABELS: Record<PlanningType, string> = {
  travail: "Travail", teletravail: "Télétravail", reunion: "Réunion", deplacement: "Déplacement", formation: "Formation", autre: "Autre",
};
export const TIME_EVENT_LABELS: Record<TimeEvent, string> = {
  arrivee: "Arrivée", pause_debut: "Début pause", pause_fin: "Fin pause", sortie: "Sortie",
};

export type Employee = {
  id: string; agence_id: string | null; user_id: string | null;
  civilite: string | null; prenom: string; nom: string;
  email: string | null; telephone: string | null; poste: string | null;
  manager_id: string | null; date_embauche: string | null; date_sortie: string | null;
  type_contrat: ContractType; salaire_brut_mensuel: number | null;
  jours_conges_par_an: number; jours_rtt_par_an: number;
  notes: string | null; actif: boolean; created_at: string;
};

export type Contract = {
  id: string; employee_id: string; agence_id: string | null;
  titre: string; type_contrat: ContractType;
  date_debut: string | null; date_fin: string | null;
  pdf_url: string | null; contenu_html: string | null;
  statut: ContractStatut; token: string; expires_at: string;
  signature_data: string | null; signataire_nom: string | null;
  signed_at: string | null; signed_ip: string | null;
  created_at: string;
};

export type Absence = {
  id: string; employee_id: string; agence_id: string | null;
  type: AbsenceType; date_debut: string; date_fin: string;
  demi_journee_debut: boolean; demi_journee_fin: boolean;
  nb_jours: number | null; motif: string | null; justificatif_url: string | null;
  statut: AbsenceStatut; approuve_par: string | null; approuve_at: string | null;
  motif_refus: string | null; token: string; expires_at: string;
  signature_data: string | null; signed_at: string | null; signed_ip: string | null;
  created_at: string;
};

export type PlanningEntry = {
  id: string; employee_id: string; agence_id: string | null;
  date_jour: string; heure_debut: string | null; heure_fin: string | null;
  type: PlanningType; note: string | null;
};

export type TimeEntry = {
  id: string; employee_id: string; agence_id: string | null;
  event_type: TimeEvent; event_at: string; ip_address: string | null;
  user_agent: string | null; note: string | null;
};

export type Evaluation = {
  id: string; employee_id: string; agence_id: string | null;
  annee: number; date_entretien: string | null;
  bilan_n_moins_1: string | null; atteinte_objectifs: string | null;
  points_forts: string | null; axes_progres: string | null;
  formations_souhaitees: string | null; objectifs_n_plus_1: string | null;
  evolution_souhaitee: string | null; note_globale: number | null;
  auto_evaluation: any; evaluation_manager: any; evaluateur_id: string | null;
  statut: EvaluationStatut; token: string; expires_at: string;
  signature_employee: string | null; signed_employee_at: string | null;
  signature_manager: string | null; signed_manager_at: string | null;
};

export async function getMyAgenceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("user_profiles").select("agence_id").eq("user_id", user.id).maybeSingle();
  return data?.agence_id ?? null;
}

// =========== Employees ===========
export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from("hr_employees").select("*").order("nom");
  if (error) throw error; return (data ?? []) as Employee[];
}
export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase.from("hr_employees").select("*").eq("id", id).maybeSingle();
  if (error) throw error; return (data ?? null) as Employee | null;
}
export async function getEmployeeByUserId(userId: string): Promise<Employee | null> {
  const { data } = await supabase.from("hr_employees").select("*").eq("user_id", userId).maybeSingle();
  return (data ?? null) as Employee | null;
}
export async function createEmployee(input: Partial<Employee>): Promise<Employee> {
  const agence_id = await getMyAgenceId();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("hr_employees").insert({
    agence_id, created_by: user?.id ?? null,
    prenom: input.prenom ?? "", nom: input.nom ?? "",
    email: input.email ?? null, telephone: input.telephone ?? null, poste: input.poste ?? null,
    type_contrat: input.type_contrat ?? "cdi", date_embauche: input.date_embauche ?? null,
    salaire_brut_mensuel: input.salaire_brut_mensuel ?? null,
    jours_conges_par_an: input.jours_conges_par_an ?? 25, jours_rtt_par_an: input.jours_rtt_par_an ?? 0,
    actif: true,
  }).select("*").single();
  if (error) throw error; return data as Employee;
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
  if (error) throw error; return (data ?? []) as Contract[];
}
export async function createContract(employeeId: string, input: { titre: string; type_contrat: ContractType; date_debut?: string; date_fin?: string; contenu_html?: string }): Promise<Contract> {
  const employee = await getEmployee(employeeId);
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("hr_contracts").insert({
    employee_id: employeeId, agence_id: employee?.agence_id ?? null,
    titre: input.titre, type_contrat: input.type_contrat,
    date_debut: input.date_debut ?? null, date_fin: input.date_fin ?? null,
    contenu_html: input.contenu_html ?? null, statut: "brouillon", created_by: user?.id ?? null,
  }).select("*").single();
  if (error) throw error; return data as Contract;
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
  if (error) throw error; return (data ?? []) as Absence[];
}
export async function createAbsence(input: { employee_id: string; type: AbsenceType; date_debut: string; date_fin: string; motif?: string }): Promise<Absence> {
  const employee = await getEmployee(input.employee_id);
  const { data: { user } } = await supabase.auth.getUser();
  const nbJours = computeWorkingDays(input.date_debut, input.date_fin);
  const { data, error } = await supabase.from("hr_absences").insert({
    employee_id: input.employee_id, agence_id: employee?.agence_id ?? null,
    type: input.type, date_debut: input.date_debut, date_fin: input.date_fin,
    nb_jours: nbJours, motif: input.motif ?? null, statut: "demande",
    created_by: user?.id ?? null,
  }).select("*").single();
  if (error) throw error; return data as Absence;
}
export async function approveAbsence(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("hr_absences").update({
    statut: "approuvee", approuve_par: user?.id ?? null, approuve_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}
export async function rejectAbsence(id: string, motif: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("hr_absences").update({
    statut: "refusee", approuve_par: user?.id ?? null, approuve_at: new Date().toISOString(),
    motif_refus: motif,
  }).eq("id", id);
  if (error) throw error;
}

export function computeWorkingDays(start: string, end: string): number {
  const s = new Date(start); const e = new Date(end);
  let n = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

// =========== Time entries (pointage) ===========
export async function listTimeEntries(employeeId: string, fromIso?: string, toIso?: string): Promise<TimeEntry[]> {
  let q = supabase.from("hr_time_entries").select("*").eq("employee_id", employeeId).order("event_at", { ascending: false });
  if (fromIso) q = q.gte("event_at", fromIso);
  if (toIso) q = q.lte("event_at", toIso);
  const { data, error } = await q;
  if (error) throw error; return (data ?? []) as TimeEntry[];
}
export async function pointer(employeeId: string, event: TimeEvent, note?: string): Promise<void> {
  const employee = await getEmployee(employeeId);
  const { error } = await supabase.from("hr_time_entries").insert({
    employee_id: employeeId, agence_id: employee?.agence_id ?? null,
    event_type: event, event_at: new Date().toISOString(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    note: note ?? null,
  });
  if (error) throw error;
}
export async function listTimeEntriesAgence(fromIso: string, toIso: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase.from("hr_time_entries").select("*")
    .gte("event_at", fromIso).lte("event_at", toIso).order("event_at", { ascending: false });
  if (error) throw error; return (data ?? []) as TimeEntry[];
}

// =========== Planning ===========
export async function listPlanning(fromIso: string, toIso: string): Promise<PlanningEntry[]> {
  const { data, error } = await supabase.from("hr_planning_entries").select("*")
    .gte("date_jour", fromIso).lte("date_jour", toIso).order("date_jour");
  if (error) throw error; return (data ?? []) as PlanningEntry[];
}
export async function upsertPlanning(input: Partial<PlanningEntry> & { employee_id: string; date_jour: string; type: PlanningType }): Promise<void> {
  const employee = await getEmployee(input.employee_id);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("hr_planning_entries").insert({
    employee_id: input.employee_id, agence_id: employee?.agence_id ?? null,
    date_jour: input.date_jour, type: input.type,
    heure_debut: input.heure_debut ?? null, heure_fin: input.heure_fin ?? null,
    note: input.note ?? null, created_by: user?.id ?? null,
  });
  if (error) throw error;
}
export async function deletePlanning(id: string): Promise<void> {
  const { error } = await supabase.from("hr_planning_entries").delete().eq("id", id);
  if (error) throw error;
}

// =========== Evaluations ===========
export async function listEvaluations(employeeId?: string): Promise<Evaluation[]> {
  let q = supabase.from("hr_evaluations").select("*").order("annee", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw error; return (data ?? []) as Evaluation[];
}
export async function createEvaluation(employeeId: string, annee: number): Promise<Evaluation> {
  const employee = await getEmployee(employeeId);
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("hr_evaluations").insert({
    employee_id: employeeId, agence_id: employee?.agence_id ?? null,
    annee, statut: "a_completer", created_by: user?.id ?? null,
  }).select("*").single();
  if (error) throw error; return data as Evaluation;
}
export async function updateEvaluation(id: string, patch: Partial<Evaluation>): Promise<void> {
  const { error } = await supabase.from("hr_evaluations").update(patch).eq("id", id);
  if (error) throw error;
}

// =========== Settings ===========
export type HrSettings = {
  id: string; agence_id: string | null;
  email_comptable: string | null; email_comptable_cc: string | null;
  jour_envoi_recap: number; derniere_execution_at: string | null;
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
