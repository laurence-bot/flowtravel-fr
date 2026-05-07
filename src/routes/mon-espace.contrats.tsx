import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { getEmployeeByUserId, listContracts, type Contract } from "@/lib/hr";

export const Route = createFileRoute("/mon-espace/contrats")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
  component: () => <AppLayout><MyContracts /></AppLayout>,
});

function MyContracts() {
  const [items, setItems] = useState<Contract[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const e = await getEmployeeByUserId(user.id);
      if (e) setItems(await listContracts(e.id));
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="font-display text-3xl">Mes contrats</h1>
      <Card className="p-0 overflow-hidden overflow-x-auto">
        {items.length === 0 ? <div className="p-10 text-center text-muted-foreground">Aucun contrat</div> :
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Titre</th><th className="text-left px-4 py-3">Statut</th><th className="text-right px-4 py-3">Action</th></tr>
            </thead>
            <tbody>{items.map(c => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{c.titre}</td>
                <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{c.statut}</span></td>
                <td className="px-4 py-2 text-right">
                  {c.statut === "a_signer" && <a href={`/contrat-signer/${c.token}`} className="text-blue-600 hover:underline text-xs">Signer →</a>}
                  {c.statut === "signe" && <span className="text-xs text-green-700">Signé le {c.signed_at?.slice(0,10)}</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        }
      </Card>
    </div>
  );
}
