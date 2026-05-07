export type AppRole =
  | "super_admin"
  | "administrateur"
  | "agent"
  | "gestion"
  | "comptable"
  | "lecture_seule";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin:    "Super Admin FlowTravel",
  administrateur: "Administrateur",
  agent:          "Agent",
  gestion:        "Gestion",
  comptable:      "Comptable",
  lecture_seule:  "Lecture seule",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin:    "Accès total à toutes les agences et outils internes FlowTravel",
  administrateur: "Accès complet à l'agence, gestion des agents, finances et paramètres",
  agent:          "Gestion commerciale : dossiers, cotations, demandes, contacts",
  gestion:        "Gestion opérationnelle sans accès aux finances ni aux utilisateurs",
  comptable:      "Accès aux modules financiers uniquement",
  lecture_seule:  "Consultation uniquement, aucune modification possible",
};

const ROUTE_ACCESS: Record<AppRole, string[]> = {
  super_admin: [
    "/", "/app", "/pilotage", "/contacts", "/dossiers", "/factures",
    "/factures-clients", "/bulletins", "/carnets", "/mariages", "/paiements",
    "/coaching", "/comptes", "/couvertures-fx", "/previsions", "/import-bancaire",
    "/rapprochement", "/export", "/audit", "/utilisateurs", "/import-pdf",
    "/cotations", "/demandes", "/parametres-agence", "/support", "/ops",
    "/mon-espace", "/suivi-dossiers",
    "/admin-dashboard", "/admin-agences", "/admin-demos",
    "/admin-messages", "/admin-errors", "/admin-billing",
  ],
  administrateur: [
    "/", "/app", "/pilotage", "/contacts", "/dossiers", "/factures",
    "/factures-clients", "/bulletins", "/carnets", "/mariages", "/paiements",
    "/coaching", "/comptes", "/couvertures-fx", "/previsions", "/import-bancaire",
    "/rapprochement", "/export", "/audit", "/utilisateurs", "/import-pdf",
    "/cotations", "/demandes", "/parametres-agence", "/support",
    "/mon-espace", "/suivi-dossiers",
  ],
  agent: [
    "/", "/app", "/pilotage", "/contacts", "/dossiers", "/factures",
    "/factures-clients", "/bulletins", "/carnets", "/mariages",
    "/cotations", "/demandes", "/coaching", "/support",
    "/mon-espace", "/suivi-dossiers",
    "/ops/equipe/planning",
  ],
  gestion: [
    "/", "/app", "/pilotage", "/contacts", "/dossiers",
    "/cotations", "/demandes", "/support", "/mon-espace",
  ],
  comptable: [
    "/", "/app", "/comptes", "/paiements", "/rapprochement",
    "/import-bancaire", "/export", "/couvertures-fx", "/previsions",
    "/support", "/mon-espace",
  ],
  lecture_seule: [
    "/", "/app", "/mon-espace",
  ],
};

export function canAccessRoute(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROUTE_ACCESS[role];
  if (path === "/") return allowed.includes("/");
  return allowed.some((p) => p !== "/" && (path === p || path.startsWith(p + "/")));
}

export function canWrite(role: AppRole | null): boolean {
  return role === "super_admin" || role === "administrateur"
    || role === "agent" || role === "gestion";
}

export function canWriteIn(
  role: AppRole | null,
  module: "dossiers" | "contacts" | "paiements" | "comptes"
    | "rapprochement" | "import" | "users"
): boolean {
  if (!role) return false;
  if (role === "super_admin" || role === "administrateur") return true;
  if (role === "agent" || role === "gestion") {
    return module === "dossiers" || module === "contacts";
  }
  if (role === "comptable") {
    return module === "paiements" || module === "comptes"
      || module === "rapprochement" || module === "import";
  }
  return false;
}

export function isSuperAdmin(role: AppRole | null): boolean {
  return role === "super_admin";
}

export function isAdmin(role: AppRole | null): boolean {
  return role === "super_admin" || role === "administrateur";
}

export function isAgent(role: AppRole | null): boolean {
  return role === "agent";
}

export function canManageAgents(role: AppRole | null): boolean {
  return role === "super_admin" || role === "administrateur";
}
