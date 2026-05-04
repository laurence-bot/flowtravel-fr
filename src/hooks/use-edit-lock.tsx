import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Verrou doux collaboratif via Supabase Realtime Presence.
 *
 * - Le 1er utilisateur à arriver sur la page devient "éditeur" (canEdit = true).
 * - Les suivants sont "lecteurs" (canEdit = false) et voient qui édite.
 * - Un lecteur peut "demander la main" : un broadcast est envoyé à l'éditeur,
 *   qui peut céder le verrou (ou ignorer).
 * - Verrou auto-libéré à la fermeture de l'onglet (presence leave) ou après
 *   2 min d'inactivité (l'utilisateur perd son statut d'éditeur).
 */

export type LockUser = {
  user_id: string;
  full_name: string;
  joined_at: string;
  is_editor: boolean;
};

const INACTIVITY_MS = 2 * 60 * 1000; // 2 minutes

export function useEditLock(resource: string, resourceId: string | undefined) {
  const { user } = useAuth();
  const [users, setUsers] = useState<LockUser[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [editor, setEditor] = useState<LockUser | null>(null);
  const [takeoverRequest, setTakeoverRequest] = useState<{ from: string; name: string } | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const myFullNameRef = useRef<string>("");
  const isEditorRef = useRef<boolean>(false);

  // Récupère le nom de l'utilisateur connecté
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      myFullNameRef.current =
        data?.full_name?.trim() || data?.email?.split("@")[0] || "Utilisateur";
    })();
  }, [user]);

  // Suit l'activité utilisateur (mouse, clavier)
  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, []);

  // Channel Presence
  useEffect(() => {
    if (!user || !resourceId) return;

    const channelName = `edit-lock:${resource}:${resourceId}`;
    const myJoinedAt = new Date().toISOString();

    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    const computeEditor = (state: Record<string, any[]>) => {
      const all: LockUser[] = [];
      for (const key of Object.keys(state)) {
        const presences = state[key] as any[];
        if (presences && presences[0]) {
          all.push({
            user_id: key,
            full_name: presences[0].full_name || "Utilisateur",
            joined_at: presences[0].joined_at || new Date().toISOString(),
            is_editor: false,
          });
        }
      }
      // L'éditeur = celui qui est arrivé le 1er
      all.sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      if (all.length > 0) all[0].is_editor = true;
      return all;
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const list = computeEditor(state as any);
        setUsers(list);
        const ed = list.find((u) => u.is_editor) || null;
        setEditor(ed);
        const meEditor = ed?.user_id === user.id;
        setCanEdit(meEditor);
        isEditorRef.current = meEditor;
      })
      .on("broadcast", { event: "request_takeover" }, ({ payload }) => {
        if (payload.target === user.id && isEditorRef.current) {
          setTakeoverRequest({ from: payload.from, name: payload.name });
        }
      })
      .on("broadcast", { event: "release_to" }, ({ payload }) => {
        if (payload.target === user.id) {
          // L'autre cède le verrou : il quitte puis rejoint plus tard pour qu'on devienne 1er
          // Comme presence joined_at de l'autre va être recréé après son re-track,
          // on devient automatiquement éditeur.
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            full_name: myFullNameRef.current || "Utilisateur",
            joined_at: myJoinedAt,
          });
        }
      });

    channelRef.current = channel;

    // Vérifie l'inactivité toutes les 30s : si éditeur inactif > 2 min, on untrack/retrack
    // pour céder la place au suivant.
    const inactivityInterval = setInterval(async () => {
      if (
        isEditorRef.current &&
        Date.now() - lastActivityRef.current > INACTIVITY_MS &&
        users.length > 1
      ) {
        await channel.untrack();
        setTimeout(() => {
          channel.track({
            full_name: myFullNameRef.current || "Utilisateur",
            joined_at: new Date().toISOString(),
          });
        }, 500);
      }
    }, 30000);

    return () => {
      clearInterval(inactivityInterval);
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, resource, resourceId]);

  const requestTakeover = useCallback(async () => {
    if (!channelRef.current || !editor || !user) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "request_takeover",
      payload: {
        target: editor.user_id,
        from: user.id,
        name: myFullNameRef.current || "Utilisateur",
      },
    });
  }, [editor, user]);

  const grantTakeover = useCallback(async () => {
    if (!channelRef.current || !takeoverRequest) return;
    // L'éditeur quitte puis re-rejoint avec un nouveau joined_at,
    // ce qui rend le demandeur (plus ancien) automatiquement éditeur.
    await channelRef.current.untrack();
    setTakeoverRequest(null);
    setTimeout(() => {
      channelRef.current?.track({
        full_name: myFullNameRef.current || "Utilisateur",
        joined_at: new Date().toISOString(),
      });
    }, 500);
  }, [takeoverRequest]);

  const dismissTakeover = useCallback(() => setTakeoverRequest(null), []);

  return {
    canEdit,
    editor,
    users,
    isAlone: users.length <= 1,
    takeoverRequest,
    requestTakeover,
    grantTakeover,
    dismissTakeover,
  };
}
