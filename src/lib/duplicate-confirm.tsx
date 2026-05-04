import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionDoublon } from "@/lib/dedup";

// Singleton store pour ouvrir la modale depuis n'importe où sans Context.
type Resolver = (action: ActionDoublon | "ANNULER") => void;
type State = {
  open: boolean;
  title: string;
  message: string;
  resolver: Resolver | null;
  canReplace: boolean;
};

let setStateExternal: ((s: State) => void) | null = null;
let currentState: State = {
  open: false,
  title: "Doublon détecté",
  message: "",
  resolver: null,
  canReplace: true,
};

export function askDuplicate(opts: {
  title?: string;
  message: string;
  canReplace?: boolean;
}): Promise<ActionDoublon | "ANNULER"> {
  return new Promise((resolve) => {
    currentState = {
      open: true,
      title: opts.title ?? "Doublon détecté",
      message: opts.message,
      canReplace: opts.canReplace ?? true,
      resolver: resolve,
    };
    setStateExternal?.(currentState);
  });
}

export function DuplicateConfirmDialog() {
  const [state, setState] = useState<State>(currentState);

  useEffect(() => {
    setStateExternal = setState;
    return () => {
      setStateExternal = null;
    };
  }, []);

  const respond = (action: ActionDoublon | "ANNULER") => {
    state.resolver?.(action);
    const next = { ...state, open: false, resolver: null };
    currentState = next;
    setState(next);
  };

  return (
    <AlertDialog
      open={state.open}
      onOpenChange={(o) => {
        if (!o) respond("ANNULER");
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {state.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={() => respond("IGNORER")}>
            Ignorer
          </AlertDialogCancel>
          {state.canReplace && (
            <Button variant="secondary" onClick={() => respond("REMPLACER")}>
              Remplacer
            </Button>
          )}
          <AlertDialogAction onClick={() => respond("AJOUTER_QUAND_MEME")}>
            Ajouter quand même
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
