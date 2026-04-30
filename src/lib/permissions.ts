export type AppRole = "administrateur" | "agent";

export const ROLE_LABELS: Record<AppRole, string> = {
  administrateur: "Administrateur",
  agent: "Agent",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  administrateur: "Accès complet, gestion des utilisateurs, finances et paramètres",
  agent: "Gestion commerciale : dossiers, cotations, demandes, contacts, factures",
};

/** Routes visibles par rôle. Si non listée → accès refusé. */
const ROUTE_ACCESS: Record<AppRole, string[]> = {
  administrateur: [
    "/", "/pilotage", "/contacts", "/dossiers", "/factures", "/paiements",
    "/comptes", "/couvertures-fx", "/previsions", "/import-bancaire", "/rapprochement",
    "/export", "/audit", "/utilisateurs", "/import-pdf", "/cotations", "/demandes", "/parametres-agence",
  ],
  agent: [
    "/", "/pilotage", "/contacts", "/dossiers", "/factures", "/cotations", "/demandes",
  ],
};

export function canAccessRoute(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROUTE_ACCESS[role];
  if (path === "/") return allowed.includes("/");
  return allowed.some((p) => p !== "/" && (path === p || path.startsWith(p + "/")));
}

/** Peut écrire (créer/modifier/supprimer) ? */
export function canWrite(role: AppRole | null): boolean {
  return role === "administrateur" || role === "agent";
}

/** Peut écrire dans un module donné. Agent : pas d'accès aux finances ni aux utilisateurs. */
export function canWriteIn(
  role: AppRole | null,
  module: "dossiers" | "contacts" | "paiements" | "comptes" | "rapprochement" | "import" | "users"
): boolean {
  if (!role) return false;
  if (role === "administrateur") return true;
  if (role === "agent") {
    return module === "dossiers" || module === "contacts";
  }
  return false;
}

export function isAdmin(role: AppRole | null): boolean {
  return role === "administrateur";
}

export function isAgent(role: AppRole | null): boolean {
  return role === "agent";
}
