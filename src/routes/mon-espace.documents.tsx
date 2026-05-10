import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import {
  getEmployeeByUserId,
  listHrDocuments,
  DOC_CATEGORIE_LABELS,
  DOC_CATEGORIE_ICONS,
  type DocCategorie,
  type HrDocument,
} from "@/lib/hr";

export const Route = createFileRoute("/mon-espace/documents")({
  component: () => (
    <RequireAuth>
      <MyDocuments />
    </RequireAuth>
  ),
});

function MyDocuments() {
  const [docs, setDocs] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("tous");

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const e = await getEmployeeByUserId(user.id);
        if (e) setDocs(await listHrDocuments(e.id));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () => (filterCat === "tous" ? docs : docs.filter((d) => d.categorie === filterCat)),
    [docs, filterCat],
  );

  const grouped = useMemo(() => {
    const g = new Map<DocCategorie, HrDocument[]>();
    for (const d of filtered) {
      const arr = g.get(d.categorie) ?? [];
      arr.push(d);
      g.set(d.categorie, arr);
    }
    return Array.from(g.entries());
  }, [filtered]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl">Mes documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulletins de paie, contrats, avenants et autres documents partagés par votre employeur.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Catégorie</label>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Toutes catégories</SelectItem>
            {(Object.keys(DOC_CATEGORIE_LABELS) as DocCategorie[]).map((c) => (
              <SelectItem key={c} value={c}>
                {DOC_CATEGORIE_ICONS[c]} {DOC_CATEGORIE_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">Chargement…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Aucun document pour le moment.
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <Card key={cat} className="p-0 overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b text-sm font-medium flex items-center gap-2">
                <span>{DOC_CATEGORIE_ICONS[cat]}</span>
                <span>{DOC_CATEGORIE_LABELS[cat]}</span>
                <span className="text-muted-foreground text-xs">({items.length})</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="text-left px-4 py-2">Document</th>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-right px-4 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="px-4 py-2">
                        <div className="font-medium">{d.titre}</div>
                        {d.description && (
                          <div className="text-xs text-muted-foreground">{d.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">{d.date_document ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {d.pdf_url ? (
                          <a href={d.pdf_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">
                              <Download className="h-3.5 w-3.5 mr-1" /> Télécharger
                            </Button>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pas de PDF</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
