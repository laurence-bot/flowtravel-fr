import { createFileRoute, useRouter } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Circle, PlayCircle, FileText, ListChecks, Link2, BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coaching")({
  component: () => (
    <RequireAuth>
      <CoachingPage />
    </RequireAuth>
  ),
});

type Ressource = {
  id: string;
  titre: string;
  description: string | null;
  type: "article" | "video" | "checklist" | "template" | "lien";
  categorie: "demarrage" | "ventes" | "finance" | "legal" | "outils" | "astuces";
  contenu_md: string | null;
  url_externe: string | null;
  duree_minutes: number | null;
  ordre: number;
  obligatoire: boolean;
};

type Progression = {
  ressource_id: string;
  statut: "non_commence" | "en_cours" | "termine";
  termine_at: string | null;
};

const CATEGORIES: { id: Ressource["categorie"]; label: string }[] = [
  { id: "demarrage", label: "Démarrage" },
  { id: "ventes", label: "Ventes" },
  { id: "finance", label: "Finance" },
  { id: "legal", label: "Légal" },
  { id: "outils", label: "Outils" },
  { id: "astuces", label: "Astuces" },
];

const TYPE_ICONS = {
  article: FileText,
  video: PlayCircle,
  checklist: ListChecks,
  template: BookOpen,
  lien: Link2,
};

function CoachingPage() {
  const router = useRouter();
  const [ressources, setRessources] = useState<Ressource[]>([]);
  const [progression, setProgression] = useState<Record<string, Progression>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ressource | null>(null);
  const [activeTab, setActiveTab] = useState<string>("demarrage");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.navigate({ to: "/auth" });
      return;
    }

    const [resR, progR] = await Promise.all([
      supabase.from("coaching_ressources").select("*").eq("publie", true).order("ordre"),
      supabase.from("coaching_progression").select("ressource_id, statut, termine_at").eq("user_id", user.id),
    ]);

    if (resR.data) setRessources(resR.data as Ressource[]);
    if (progR.data) {
      const map: Record<string, Progression> = {};
      for (const p of progR.data) map[p.ressource_id] = p as Progression;
      setProgression(map);
    }
    setLoading(false);
  }

  async function setStatut(ressource: Ressource, statut: Progression["statut"]) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      ressource_id: ressource.id,
      statut,
      termine_at: statut === "termine" ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from("coaching_progression")
      .upsert(payload, { onConflict: "user_id,ressource_id" });

    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setProgression((prev) => ({ ...prev, [ressource.id]: payload as Progression }));
    if (statut === "termine") toast.success("Marqué comme terminé 🎉");
  }

  const stats = useMemo(() => {
    const total = ressources.length;
    const done = ressources.filter((r) => progression[r.id]?.statut === "termine").length;
    const oblig = ressources.filter((r) => r.obligatoire);
    const obligDone = oblig.filter((r) => progression[r.id]?.statut === "termine").length;
    return {
      total,
      done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      obligDone,
      obligTotal: oblig.length,
    };
  }, [ressources, progression]);

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6 max-w-6xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Coaching</h1>
            <p className="text-muted-foreground mt-1">
              Ressources, tutos et bonnes pratiques pour réussir avec FlowTravel
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground">Votre progression</p>
                <p className="text-2xl font-bold">
                  {stats.done} / {stats.total} ressources
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Étapes essentielles</p>
                <p className="text-2xl font-bold">
                  {stats.obligDone} / {stats.obligTotal}
                </p>
              </div>
            </div>
            <Progress value={stats.pct} className="h-2" />
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            {CATEGORIES.map((c) => {
              const count = ressources.filter((r) => r.categorie === c.id).length;
              if (count === 0) return null;
              return (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.label}{" "}
                  <Badge variant="secondary" className="ml-2">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CATEGORIES.map((c) => (
            <TabsContent key={c.id} value={c.id} className="space-y-3 mt-6">
              {loading ? (
                <p className="text-muted-foreground">Chargement…</p>
              ) : (
                ressources
                  .filter((r) => r.categorie === c.id)
                  .map((r) => {
                    const Icon = TYPE_ICONS[r.type];
                    const statut = progression[r.id]?.statut ?? "non_commence";
                    const isDone = statut === "termine";
                    return (
                      <Card key={r.id} className={isDone ? "border-primary/30 bg-primary/5" : ""}>
                        <CardHeader>
                          <div className="flex items-start gap-4">
                            <div className="mt-1">
                              {isDone ? (
                                <CheckCircle2 className="w-6 h-6 text-primary" />
                              ) : (
                                <Circle className="w-6 h-6 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <CardTitle className="text-base">{r.titre}</CardTitle>
                                {r.obligatoire && (
                                  <Badge variant="outline" className="text-xs">
                                    Essentiel
                                  </Badge>
                                )}
                                {r.duree_minutes && (
                                  <span className="text-xs text-muted-foreground">~{r.duree_minutes} min</span>
                                )}
                              </div>
                              {r.description && <CardDescription className="mt-1">{r.description}</CardDescription>}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                                Ouvrir
                              </Button>
                              {!isDone ? (
                                <Button size="sm" onClick={() => setStatut(r, "termine")}>
                                  Marquer fait
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => setStatut(r, "non_commence")}>
                                  Réinitialiser
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })
              )}
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.titre}</DialogTitle>
                  {selected.description && <DialogDescription>{selected.description}</DialogDescription>}
                </DialogHeader>
                <div className="prose prose-sm max-w-none dark:prose-invert mt-4">
                  {selected.contenu_md && (
                    <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 p-4 rounded-md">
                      {selected.contenu_md}
                    </pre>
                  )}
                  {selected.url_externe && (
                    <Button asChild className="mt-4" variant="outline">
                      <a href={selected.url_externe} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Ouvrir la ressource
                      </a>
                    </Button>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  {progression[selected.id]?.statut !== "termine" ? (
                    <Button
                      onClick={() => {
                        setStatut(selected, "termine");
                        setSelected(null);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Marquer comme terminé
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="self-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Terminé
                    </Badge>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
