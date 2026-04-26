import { Lock } from "lucide-react";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { ROLE_LABELS } from "@/lib/permissions";

/**
 * Bannière + zone "lecture seule" : si l'utilisateur n'a pas le droit d'écrire
 * sur la page courante, on désactive tous les boutons et inputs au sein de
 * cet arbre (defense en profondeur côté UI ; la sécurité réelle est en RLS).
 */
export function ReadOnlyShield({ children }: { children: React.ReactNode }) {
  const { canWrite, role } = usePageWriteAccess();
  if (canWrite) return <>{children}</>;

  return (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
        <Lock className="h-4 w-4 shrink-0" />
        <div>
          <span className="font-medium">Mode lecture seule</span>
          <span className="text-amber-700/80 dark:text-amber-200/70">
            {" "}— votre rôle ({role ? ROLE_LABELS[role] : "—"}) ne permet pas de modifier les données de cette page.
          </span>
        </div>
      </div>
      <fieldset disabled className="contents [&_button[type=submit]]:cursor-not-allowed [&_button:not([data-rw-allow])]:cursor-not-allowed">
        {children}
      </fieldset>
    </>
  );
}
