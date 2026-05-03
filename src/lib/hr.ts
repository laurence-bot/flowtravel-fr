import { supabase } from "@/integrations/supabase/client";

export type ContractType = "cdi" | "cdd" | "stage" | "alternance" | "freelance" | "interim" | "autre";

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  cdi: "CDI",
  cdd: "CDD",
  stage: "Stage",
  alternance: "Alternance",
  freelance: "Freelance",
  interim: "Intérim",
  autre: "Autre",
};

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
};

export async function getMyAgenceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("agence_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.agence_id ?? null;
}

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("hr_employees")
    .select("*")
    .order("nom", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Employee[];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from("hr_employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Employee | null;
}

export async function createEmployee(input: Partial<Employee>): Promise<Employee> {
  const agence_id = await getMyAgenceId();
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
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
  };
  const { data, error } = await supabase
    .from("hr_employees")
    .insert(payload)
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

// ============== Settings ==============

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
  const { data } = await supabase
    .from("hr_settings")
    .select("*")
    .eq("agence_id", agence_id)
    .maybeSingle();
  return (data ?? null) as HrSettings | null;
}

export async function upsertHrSettings(patch: Partial<HrSettings>): Promise<void> {
  const agence_id = await getMyAgenceId();
  const { error } = await supabase
    .from("hr_settings")
    .upsert({ agence_id, ...patch }, { onConflict: "agence_id" });
  if (error) throw error;
}
