import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) setState("invalid");
        else if (j.valid) setState("valid");
        else setState("already");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    const r = await fetch("/email/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await r.json();
    setState(j.success ? "done" : "already");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
        <h1 className="font-display text-2xl mb-4">Désabonnement</h1>
        {state === "loading" && <p className="text-stone-600">Vérification…</p>}
        {state === "valid" && (
          <>
            <p className="text-stone-600 mb-6">Confirmer le désabonnement de cette adresse email ?</p>
            <button onClick={confirm} className="px-5 py-2.5 rounded bg-black text-white text-sm">Confirmer</button>
          </>
        )}
        {state === "already" && <p className="text-stone-600">Vous êtes déjà désabonné(e).</p>}
        {state === "done" && <p className="text-green-700">Désabonnement confirmé. À bientôt.</p>}
        {state === "invalid" && <p className="text-red-600">Lien invalide ou expiré.</p>}
        {state === "error" && <p className="text-red-600">Une erreur est survenue.</p>}
        <div className="mt-8"><Link to="/" className="text-xs text-stone-500 hover:underline">Retour</Link></div>
      </div>
    </div>
  );
}
