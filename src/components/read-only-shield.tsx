import { Lock } from "lucide-react";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { ROLE_LABELS } from "@/lib/permissions";

/**
 * Bannière "lecture seule". Les actions d'écriture sont masquées/désactivées
 * dans les pages via usePageWriteAccess ; cette bannière ne bloque jamais la
 * navigation afin de permettre l'ouverture des fiches et détails.
 */
export function ReadOnlyShield({ children }: { children: React.ReactNode }) {
  const { canWrite, role } = usePageWriteAccess();
  if (canWrite) return <>{children}</>;

  return (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-md border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-3 text-sm text-foreground">
        <Lock className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
        <div>
          <span className="font-medium">Mode lecture seule</span>
          <span className="text-muted-foreground">
            {" "}— votre rôle ({role ? ROLE_LABELS[role] : "—"}) ne permet pas de modifier les données de cette page.
          </span>
        </div>
      </div>
      {children}
    </>
  );
}
