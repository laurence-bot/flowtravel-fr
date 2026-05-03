import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron mensuel : 1er du mois → envoie un récap à chaque agence ayant un email_comptable.
 * Couvre le mois précédent.
 */
export const Route = createFileRoute("/api/public/hooks/payroll-summary")({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "missing config" }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, serviceKey);

        const now = new Date();
        const firstThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const firstLast = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const fromIso = firstLast.toISOString().slice(0, 10);
        const toIso = new Date(firstThis.getTime() - 86400000).toISOString().slice(0, 10);
        const moisLibelle = firstLast.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

        const { data: settingsRows } = await supabase
          .from("hr_settings")
          .select("agence_id, email_comptable, email_comptable_cc")
          .not("email_comptable", "is", null);

        let processed = 0;
        for (const s of settingsRows ?? []) {
          if (!s.agence_id || !s.email_comptable) continue;
          const { data: agence } = await supabase.from("agences").select("nom_commercial").eq("id", s.agence_id).maybeSingle();
          const { data: employees } = await supabase.from("hr_employees").select("*").eq("agence_id", s.agence_id).eq("actif", true);
          const rows: any[] = [];
          for (const emp of employees ?? []) {
            const { data: abs } = await supabase.from("hr_absences").select("type, date_debut, date_fin, nb_jours, statut")
              .eq("employee_id", emp.id).gte("date_debut", fromIso).lte("date_fin", toIso)
              .in("statut", ["approuvee", "signee"]);
            const sum = (t: string) => (abs ?? []).filter((a: any) => a.type === t).reduce((acc: number, a: any) => acc + Number(a.nb_jours ?? 0), 0);
            const cp = sum("conge_paye"); const rtt = sum("rtt"); const mal = sum("maladie");
            const autres = (abs ?? []).filter((a: any) => !["conge_paye", "rtt", "maladie"].includes(a.type)).reduce((acc: number, a: any) => acc + Number(a.nb_jours ?? 0), 0);
            const { data: times } = await supabase.from("hr_time_entries").select("event_type, event_at")
              .eq("employee_id", emp.id).gte("event_at", fromIso).lte("event_at", toIso + "T23:59:59Z")
              .order("event_at");
            const heures = computeHours(times ?? []);
            const wd = workingDays(fromIso, toIso) - cp - rtt - mal - autres;
            rows.push({
              prenom: emp.prenom, nom: emp.nom, poste: emp.poste,
              jours_travailles: Math.max(0, wd), conges_payes: cp, rtt, maladie: mal,
              autres_absences: autres, heures_pointees: heures,
            });
          }

          // enqueue via existing send route
          await fetch(new URL("/lovable/email/transactional/send", `https://project--af9a414d-dfc5-4720-8a22-45828934bfaa.lovable.app`).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              templateName: "payroll-monthly",
              recipientEmail: s.email_comptable,
              idempotencyKey: `payroll-${s.agence_id}-${fromIso}`,
              templateData: { agence_nom: agence?.nom_commercial ?? "Agence", mois_libelle: moisLibelle, rows },
            }),
          }).catch((e) => console.error("send fail", e));

          await supabase.from("hr_settings").update({ derniere_execution_at: new Date().toISOString() }).eq("agence_id", s.agence_id);
          processed++;
        }

        return Response.json({ ok: true, processed, period: { from: fromIso, to: toIso } });
      },
    },
  },
});

function workingDays(start: string, end: string): number {
  const s = new Date(start); const e = new Date(end);
  let n = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

function computeHours(times: { event_type: string; event_at: string }[]): number {
  // pair arrivee→sortie, soustraire pauses
  let total = 0;
  let arrivee: number | null = null;
  let pauseStart: number | null = null;
  let pauseTotal = 0;
  for (const t of times) {
    const ts = new Date(t.event_at).getTime();
    if (t.event_type === "arrivee") { arrivee = ts; pauseTotal = 0; pauseStart = null; }
    else if (t.event_type === "pause_debut") { pauseStart = ts; }
    else if (t.event_type === "pause_fin" && pauseStart) { pauseTotal += ts - pauseStart; pauseStart = null; }
    else if (t.event_type === "sortie" && arrivee) {
      total += (ts - arrivee - pauseTotal) / 3_600_000;
      arrivee = null; pauseTotal = 0;
    }
  }
  return Math.round(total * 10) / 10;
}
