import { useRole } from "@/hooks/use-role";
import { useLocation } from "@tanstack/react-router";
import { canWrite, canWriteIn, type AppRole } from "@/lib/permissions";

/** Mappe un chemin de route vers le module de permission correspondant. */
function moduleFromPath(path: string): "dossiers" | "contacts" | "paiements" | "comptes" | "rapprochement" | "import" | "users" | null {
  if (path.startsWith("/dossiers")) return "dossiers";
  if (path.startsWith("/contacts")) return "contacts";
  if (path.startsWith("/paiements")) return "paiements";
  if (path.startsWith("/comptes")) return "comptes";
  if (path.startsWith("/rapprochement")) return "rapprochement";
  if (path.startsWith("/import-bancaire")) return "import";
  if (path.startsWith("/utilisateurs")) return "users";
  return null;
}

/** True si le rôle peut effectuer des actions d'écriture sur la page courante. */
export function usePageWriteAccess(): { canWrite: boolean; role: AppRole | null } {
  const { role } = useRole();
  const location = useLocation();
  const mod = moduleFromPath(location.pathname);
  if (!mod) return { canWrite: canWrite(role), role };
  return { canWrite: canWriteIn(role, mod), role };
}
