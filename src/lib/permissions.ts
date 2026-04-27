export type AppRole = "administrateur" | "gestion" | "lecture_seule" | "comptable";

export const ROLE_LABELS: Record<AppRole, string> = {
  administrateur: "Administrateur",
  gestion: "Gestion",
  lecture_seule: "Lecture seule",
  comptable: "Comptable",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  administrateur: "Accès complet, gestion des utilisateurs",
  gestion: "Création et modification, hors utilisateurs",
  lecture_seule: "Consultation uniquement",
  comptable: "Paiements, factures, exports, audit",
};

/** Routes visibles par rôle. Si non listée → accès refusé. */
const ROUTE_ACCESS: Record<AppRole, string[]> = {
  administrateur: [
    "/", "/pilotage", "/contacts", "/dossiers", "/factures", "/paiements",
    "/comptes", "/couvertures-fx", "/previsions", "/import-bancaire", "/rapprochement",
    "/export", "/audit", "/utilisateurs", "/import-pdf", "/cotations", "/demandes",
  ],
  gestion: [
    "/", "/pilotage", "/contacts", "/dossiers", "/factures", "/paiements",
    "/comptes", "/couvertures-fx", "/previsions", "/import-bancaire", "/rapprochement",
    "/export", "/import-pdf", "/cotations", "/demandes",
  ],
  lecture_seule: [
    "/", "/pilotage", "/contacts", "/dossiers", "/factures", "/paiements",
    "/comptes", "/couvertures-fx", "/previsions", "/rapprochement", "/export", "/audit", "/cotations", "/demandes",
  ],
  comptable: ["/", "/paiements", "/dossiers", "/factures", "/export", "/audit"],
};

export function canAccessRoute(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROUTE_ACCESS[role];
  if (path === "/") return allowed.includes("/");
  return allowed.some((p) => p !== "/" && (path === p || path.startsWith(p + "/")));
}

/** Peut écrire (créer/modifier/supprimer) ? Lecture seule = non. */
export function canWrite(role: AppRole | null): boolean {
  return role === "administrateur" || role === "gestion" || role === "comptable";
}

/** Peut écrire dans un module donné. Comptable limité à paiements/factures/exports. */
export function canWriteIn(role: AppRole | null, module: "dossiers" | "contacts" | "paiements" | "comptes" | "rapprochement" | "import" | "users"): boolean {
  if (!role) return false;
  if (role === "lecture_seule") return false;
  if (role === "administrateur") return true;
  if (role === "gestion") return module !== "users";
  if (role === "comptable") return module === "paiements";
  return false;
}

export function isAdmin(role: AppRole | null): boolean {
  return role === "administrateur";
}
