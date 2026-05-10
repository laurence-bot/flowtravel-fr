import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Helpers anti-contention sur le lock interne `lock:sb-…-auth-token`.
 *
 * Quand plusieurs `supabase.auth.getUser()` partent en parallèle (ex. Promise.all
 * sur 30 upserts), ils se volent le lock mutuellement et l'erreur
 * "Lock was released because another request stole it" remonte côté UI.
 *
 * On dédoublonne ici la promesse en cours + on mémorise l'agence_id pour la session.
 */

let currentUserPromise: Promise<User | null> | null = null;
let cachedUserId: string | null = null;
let cachedAgenceIdByUser: Record<string, string | null> = {};
let agencePromiseByUser: Record<string, Promise<string | null>> = {};

export async function getCurrentUserSafe(): Promise<User | null> {
  if (!currentUserPromise) {
    currentUserPromise = supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) throw error;
        cachedUserId = data.user?.id ?? null;
        return data.user ?? null;
      })
      .finally(() => {
        currentUserPromise = null;
      });
  }
  return currentUserPromise;
}

export async function getCurrentUserIdSafe(): Promise<string | null> {
  const user = await getCurrentUserSafe();
  return user?.id ?? null;
}

export async function getMyAgenceIdSafe(): Promise<string | null> {
  const userId = await getCurrentUserIdSafe();
  if (!userId) return null;
  if (userId in cachedAgenceIdByUser) return cachedAgenceIdByUser[userId];
  if (!agencePromiseByUser[userId]) {
    agencePromiseByUser[userId] = supabase
      .from("user_profiles")
      .select("agence_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.agence_id ?? null;
        cachedAgenceIdByUser[userId] = v;
        return v;
      })
      .finally(() => {
        delete agencePromiseByUser[userId];
      });
  }
  return agencePromiseByUser[userId];
}

// Reset des caches sur changement d'auth (login / logout / refresh user).
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
      currentUserPromise = null;
      cachedUserId = null;
      cachedAgenceIdByUser = {};
      agencePromiseByUser = {};
    }
  });
}
