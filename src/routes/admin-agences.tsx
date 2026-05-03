import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RequireAuth } from "@/components/require-auth";
import { toast } from "sonner";
import { ShieldAlert, Building2, FileText, Check, X, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { verifySiret, approveAgence, type SiretVerifResult } from "@/server/agences.functions";

export const Route = createFileRoute("/admin-agences")({
  component: AdminAgencesRoute,
});

function AdminAgencesRoute() {
  return (
    <RequireAuth>
      <AdminAgencesPage />
    </RequireAuth>
  );
}

type Agence = {
  id: string;
  nom_commercial: string;
  raison_sociale: string | null;
  immat_atout_france: string;
  siret: string;
  est_etablissement_secondaire: boolean | null;
  siren_siege: string | null;
  email_contact: string;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  statut: "en_attente" | "validee" | "refusee" | "suspendue";
  motif_refus: string | null;
  pappers_nom: string | null;
  pappers_statut_actif: boolean | null;
  pappers_verified_at: string | null;
  doc_atout_france_url: string | null;
  doc_kbis_url: string | null;
  doc_piece_identite_url: string | null;
  forfait: "solo" | "equipe" | "agence";
  max_agents: number;
  admin_user_id: string | null;
  admin_full_name: string;
  created_at: string;
};

const FORFAIT_LABEL: Record<Agence["forfait"], string> = {
  solo: "Solo (1 agent)",
  equipe: "Équipe (5 agents)",
  agence: "Agence (illimité)",
};

const STATUT_TONE: Record<Agence["statut"], string> = {
  en_attente: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  validee: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  refusee: "bg-red-500/15 text-red-700 border-red-500/30",
  suspendue: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
};

const STATUT_LABEL: Record<Agence["statut"], string> = {
  en_attente: "En attente",
  validee: "Validée",
  refusee: "Refusée",
  suspendue: "Suspendue",
};

function AdminAgencesPage() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [agences, setAgences] = useState<Agence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agence | null>(null);
  const [siretCheck, setSiretCheck] = useState<SiretVerifResult | null>(null);
  const [siretChecking, setSiretChecking] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [motifRefus, setMotifRefus] = useState("");
  const [acting, setActing] = useState(false);

  // Vérifie le statut super-admin
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("is_super_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsSuperAdmin(!!data?.is_super_admin);
    })();
  }, [user]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agences")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setAgences((data ?? []) as Agence[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) refresh();
    else if (isSuperAdmin === false) setLoading(false);
  }, [isSuperAdmin]);

  if (isSuperAdmin === null || loading) {
    return <div className="text-sm text-muted-foreground">Chargement…</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Validation des agences" description="Espace super-administrateur" />
        <Card className="p-10 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display text-lg mb-1">Accès refusé</h3>
          <p className="text-sm text-muted-foreground">
            Seul le super-administrateur peut accéder à cette page.
          </p>
        </Card>
      </div>
    );
  }

  const openDetail = (a: Agence) => {
    setSelected(a);
    setSiretCheck(
      a.pappers_verified_at
        ? {
            found: true,
            nom: a.pappers_nom ?? undefined,
            estActif: a.pappers_statut_actif ?? undefined,
            siret: a.siret,
            source: "recherche-entreprises.api.gouv.fr",
          }
        : null,
    );
    setRefusing(false);
    setMotifRefus("");
  };

  const runSiretCheck = async () => {
    if (!selected) return;
    setSiretChecking(true);
    try {
      const result = await verifySiret({ data: { siret: selected.siret } });
      setSiretCheck(result);
      // Sauvegarde le résultat
      await supabase
        .from("agences")
        .update({
          pappers_nom: result.nom ?? null,
          pappers_statut_actif: result.estActif ?? null,
          pappers_verified_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      toast.success("Vérification SIRET effectuée");
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la vérification";
      toast.error(msg);
    } finally {
      setSiretChecking(false);
    }
  };

  const validate = async () => {
    if (!selected || !user) return;
    setActing(true);
    try {
      const res = await approveAgence({ data: { agenceId: selected.id } });
      toast.success(
        `Agence "${selected.nom_commercial}" validée. Email d'invitation envoyé à ${res.email}`,
      );
      setSelected(null);
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la validation";
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  const refuse = async () => {
    if (!selected || !motifRefus.trim()) {
      toast.error("Indiquez un motif de refus");
      return;
    }
    setActing(true);
    const { error } = await supabase
      .from("agences")
      .update({
        statut: "refusee",
        motif_refus: motifRefus.trim(),
      })
      .eq("id", selected.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Demande refusée");
      setSelected(null);
      refresh();
    }
    setActing(false);
  };

  const getDocUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("agence-documents").createSignedUrl(path, 60 * 5);
    return data?.signedUrl ?? null;
  };

  const openDoc = async (path: string | null) => {
    const url = await getDocUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Document indisponible");
  };

  const enAttente = agences.filter((a) => a.statut === "en_attente");
  const autres = agences.filter((a) => a.statut !== "en_attente");

  return (
    <div>
      <PageHeader
        title="Validation des agences"
        description="Examinez les demandes d'inscription et activez les agences vérifiées"
      />

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base">
            Demandes en attente <span className="text-muted-foreground font-normal">({enAttente.length})</span>
          </h3>
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Actualiser
          </Button>
        </div>
        {enAttente.length === 0 ? (
          <EmptyState icon={Building2} title="Aucune demande" description="Toutes les demandes ont été traitées." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agence</TableHead>
                <TableHead>SIRET</TableHead>
                <TableHead>Forfait</TableHead>
                <TableHead>Demandée le</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enAttente.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetail(a)}>
                  <TableCell>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {a.nom_commercial}
                      {a.est_etablissement_secondaire && (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]">
                          Établ. secondaire
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.email_contact} · {a.admin_full_name}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{a.siret}</TableCell>
                  <TableCell className="text-sm">{FORFAIT_LABEL[a.forfait]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(a.created_at), "dd MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openDetail(a); }}>
                      Examiner
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {autres.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-base mb-3">
            Autres agences <span className="text-muted-foreground font-normal">({autres.length})</span>
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agence</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Forfait</TableHead>
                <TableHead>SIRET</TableHead>
                <TableHead className="text-right">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {autres.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetail(a)}>
                  <TableCell>
                    <div className="font-medium text-sm">{a.nom_commercial}</div>
                    <div className="text-xs text-muted-foreground">{a.email_contact}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUT_TONE[a.statut]}>{STATUT_LABEL[a.statut]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{FORFAIT_LABEL[a.forfait]}</TableCell>
                  <TableCell className="font-mono text-xs">{a.siret}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(a); }}>
                      Voir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal détail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selected.nom_commercial}
                  <Badge variant="outline" className={STATUT_TONE[selected.statut]}>
                    {STATUT_LABEL[selected.statut]}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Demande déposée le {format(new Date(selected.created_at), "dd MMMM yyyy", { locale: fr })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Identité */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Identité</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Field label="Raison sociale" value={selected.raison_sociale ?? "—"} />
                    <Field label="ATOUT FRANCE" value={selected.immat_atout_france} mono />
                    <Field label="SIRET" value={selected.siret} mono />
                    {selected.est_etablissement_secondaire && (
                      <Field
                        label="⚠ Établissement secondaire"
                        value={`Siège : ${selected.siren_siege ?? "(non renseigné)"} — vérification manuelle requise`}
                      />
                    )}
                    <Field label="Email contact" value={selected.email_contact} />
                    <Field label="Téléphone" value={selected.telephone ?? "—"} />
                    <Field label="Forfait demandé" value={FORFAIT_LABEL[selected.forfait]} />
                    <Field label="Admin" value={selected.admin_full_name} />
                    <Field
                      label="Adresse"
                      value={[selected.adresse, selected.code_postal, selected.ville].filter(Boolean).join(", ") || "—"}
                    />
                  </div>
                </section>

                {/* Vérif SIRET */}
                <section className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vérification SIRET (api.gouv.fr)
                    </h4>
                    <Button size="sm" variant="outline" onClick={runSiretCheck} disabled={siretChecking}>
                      {siretChecking ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {siretCheck ? "Re-vérifier" : "Vérifier"}
                    </Button>
                  </div>
                  {siretCheck ? (
                    siretCheck.found ? (
                      <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium">{siretCheck.nom}</span>
                          {siretCheck.estActif ? (
                            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/15 text-red-700 border-red-500/30">
                              Cessée
                            </Badge>
                          )}
                        </div>
                        {siretCheck.adresse && <div className="text-xs text-muted-foreground">📍 {siretCheck.adresse}</div>}
                        {siretCheck.activitePrincipale && (
                          <div className="text-xs text-muted-foreground">🏷️ Code APE : {siretCheck.activitePrincipale}</div>
                        )}
                        {siretCheck.dirigeants && siretCheck.dirigeants.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            👤 Dirigeant(s) :{" "}
                            {siretCheck.dirigeants
                              .slice(0, 3)
                              .map((d) => `${d.prenoms ?? ""} ${d.nom ?? ""}`.trim())
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground pt-1">
                          Source : recherche-entreprises.api.gouv.fr (données INSEE)
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 flex items-center gap-2">
                        <X className="h-4 w-4" />
                        SIRET introuvable dans le registre officiel
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Aucune vérification effectuée pour le moment.</p>
                  )}
                </section>

                {/* Vérif Atout France (manuelle) */}
                <section className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vérification Atout France (manuelle)
                    </h4>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      N° Atout France déclaré :{" "}
                      <span className="font-mono font-medium text-foreground">
                        {selected.immat_atout_france || "—"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Atout France ne fournit pas d'API publique. Vérifiez manuellement dans le registre officiel ROVS
                      (recherche par SIRET ou raison sociale).
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button asChild size="sm" variant="outline">
                        <a
                          href="https://registre-operateurs-de-voyages.atout-france.fr/web/rovs/recherche"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Ouvrir le registre ROVS
                        </a>
                      </Button>
                      {selected.siret && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(selected.siret);
                            toast.success("SIRET copié — collez-le dans le champ recherche");
                          }}
                        >
                          Copier le SIRET
                        </Button>
                      )}
                      {selected.immat_atout_france && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(selected.immat_atout_france);
                            toast.success("N° IM copié");
                          }}
                        >
                          Copier le N° IM
                        </Button>
                      )}
                    </div>
                  </div>
                </section>

                {/* Documents */}
                <section className="border-t pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Documents fournis
                  </h4>
                  <div className="space-y-2">
                    <DocLink label="Immat. ATOUT FRANCE" path={selected.doc_atout_france_url} onOpen={openDoc} />
                    <DocLink label="Kbis" path={selected.doc_kbis_url} onOpen={openDoc} />
                    <DocLink label="Pièce d'identité du dirigeant" path={selected.doc_piece_identite_url} onOpen={openDoc} />
                  </div>
                </section>

                {selected.statut === "refusee" && selected.motif_refus && (
                  <section className="border-t pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Motif du refus
                    </h4>
                    <p className="text-sm">{selected.motif_refus}</p>
                  </section>
                )}

                {/* Refus */}
                {refusing && (
                  <section className="border-t pt-4 space-y-2">
                    <Label htmlFor="motif">Motif du refus (sera envoyé à l'agence)</Label>
                    <Textarea
                      id="motif"
                      value={motifRefus}
                      onChange={(e) => setMotifRefus(e.target.value)}
                      placeholder="Ex : SIRET cessé d'activité, Kbis illisible…"
                      rows={3}
                    />
                  </section>
                )}
              </div>

              <DialogFooter className="gap-2">
                {selected.statut === "en_attente" && !refusing && (
                  <>
                    <Button variant="outline" onClick={() => setRefusing(true)} disabled={acting}>
                      <X className="h-4 w-4 mr-1.5" /> Refuser
                    </Button>
                    <Button onClick={validate} disabled={acting}>
                      {acting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                      Valider l'agence
                    </Button>
                  </>
                )}
                {refusing && (
                  <>
                    <Button variant="ghost" onClick={() => setRefusing(false)} disabled={acting}>
                      Annuler
                    </Button>
                    <Button variant="destructive" onClick={refuse} disabled={acting || !motifRefus.trim()}>
                      {acting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                      Confirmer le refus
                    </Button>
                  </>
                )}
                {selected.statut !== "en_attente" && !refusing && (
                  <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}

function DocLink({
  label,
  path,
  onOpen,
}: {
  label: string;
  path: string | null;
  onOpen: (path: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      {path ? (
        <Button size="sm" variant="ghost" onClick={() => onOpen(path)}>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Ouvrir
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground italic">Non fourni</span>
      )}
    </div>
  );
}

