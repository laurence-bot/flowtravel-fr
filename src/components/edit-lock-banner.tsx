import { Eye, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useEditLock } from "@/hooks/use-edit-lock";
import { toast } from "sonner";
import { useEffect } from "react";

type Props = {
  lock: ReturnType<typeof useEditLock>;
};

/**
 * Bannière de verrou collaboratif. À placer en haut d'une fiche éditable.
 * Affiche qui édite, qui consulte, et permet de demander/céder la main.
 *
 * IMPORTANT : passer l'instance unique du hook `useEditLock` depuis la page parente
 * (afin de partager le même channel Realtime que celui qui gouverne canWrite).
 */
export function EditLockBanner({ lock }: Props) {
  const {
    canEdit,
    editor,
    users,
    isAlone,
    takeoverRequest,
    requestTakeover,
    grantTakeover,
    dismissTakeover,
  } = lock;

  // Notification quand quelqu'un demande la main
  useEffect(() => {
    if (!takeoverRequest) return;
    toast(`${takeoverRequest.name} souhaite éditer ce document`, {
      duration: 15000,
      action: {
        label: "Céder la main",
        onClick: () => grantTakeover(),
      },
      cancel: {
        label: "Refuser",
        onClick: () => dismissTakeover(),
      },
    });
  }, [takeoverRequest, grantTakeover, dismissTakeover]);

  if (isAlone || !editor) return null;

  const otherViewers = users.filter((u) => !u.is_editor);

  if (canEdit) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm">
        <Pencil className="h-4 w-4 shrink-0 text-emerald-700" />
        <div className="flex-1">
          <span className="font-medium text-emerald-900">Vous éditez</span>
          {otherViewers.length > 0 && (
            <span className="text-emerald-800">
              {" "}— {otherViewers.map((u) => u.full_name).join(", ")}{" "}
              {otherViewers.length > 1 ? "consultent" : "consulte"} en lecture
            </span>
          )}
        </div>
        <Users className="h-4 w-4 text-emerald-700" />
        <span className="text-xs font-medium text-emerald-700">{users.length}</span>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm">
      <Eye className="h-4 w-4 shrink-0 text-amber-700" />
      <div className="flex-1">
        <span className="font-medium text-amber-900">Lecture seule</span>
        <span className="text-amber-800">
          {" "}— <strong>{editor.full_name}</strong> édite ce document
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
        onClick={() => {
          requestTakeover();
          toast.info("Demande envoyée à " + editor.full_name);
        }}
      >
        Prendre la main
      </Button>
    </div>
  );
}
