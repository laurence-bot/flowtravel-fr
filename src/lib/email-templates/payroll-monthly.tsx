import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text, Section } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Row {
  nom: string;
  prenom: string;
  poste?: string | null;
  jours_travailles: number;
  conges_payes: number;
  rtt: number;
  maladie: number;
  autres_absences: number;
  heures_pointees: number;
}

interface Props {
  agence_nom?: string;
  mois_libelle?: string;
  rows?: Row[];
  csv_url?: string | null;
}

const PayrollMonthlyEmail = ({ agence_nom, mois_libelle, rows, csv_url }: Props) => {
  const list = rows ?? [];
  return (
    <Html lang="fr">
      <Head />
      <Preview>Récap paie {mois_libelle ?? ""} — {agence_nom ?? "Flow Travel"}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Récap mensuel — {mois_libelle ?? ""}</Heading>
          <Text style={text}>
            Bonjour, voici le récapitulatif des éléments variables de paie pour {agence_nom ?? "l'agence"}.
          </Text>
          <Section>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Employé</th>
                  <th style={th}>J. trav.</th>
                  <th style={th}>CP</th>
                  <th style={th}>RTT</th>
                  <th style={th}>Mal.</th>
                  <th style={th}>Autres</th>
                  <th style={th}>H. pointées</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{r.prenom} {r.nom}{r.poste ? ` — ${r.poste}` : ""}</td>
                    <td style={tdNum}>{r.jours_travailles}</td>
                    <td style={tdNum}>{r.conges_payes}</td>
                    <td style={tdNum}>{r.rtt}</td>
                    <td style={tdNum}>{r.maladie}</td>
                    <td style={tdNum}>{r.autres_absences}</td>
                    <td style={tdNum}>{r.heures_pointees.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          {csv_url && (
            <Text style={text}>
              CSV téléchargeable : <a href={csv_url}>{csv_url}</a>
            </Text>
          )}
          <Text style={footer}>Email automatique — Flow Travel HR</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: PayrollMonthlyEmail,
  subject: (d: Record<string, any>) => `Récap paie ${d.mois_libelle ?? ""} — ${d.agence_nom ?? "Flow Travel"}`,
  displayName: "Récap mensuel comptable",
  previewData: {
    agence_nom: "Flow Travel",
    mois_libelle: "Avril 2026",
    rows: [
      { prenom: "Jane", nom: "Doe", poste: "Conseillère", jours_travailles: 20, conges_payes: 2, rtt: 0, maladie: 0, autres_absences: 0, heures_pointees: 152 },
    ],
    csv_url: null,
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "720px" };
const h1 = { fontSize: "22px", color: "#0B0B0B", margin: "0 0 16px" };
const text = { fontSize: "14px", color: "#3a3a3a", lineHeight: "1.5", margin: "0 0 16px" };
const footer = { fontSize: "11px", color: "#999", marginTop: "24px" };
const table = { width: "100%", borderCollapse: "collapse" as const, fontSize: "12px" };
const th = { textAlign: "left" as const, padding: "8px 6px", borderBottom: "1px solid #e5e5e5", color: "#666", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontSize: "10px" };
const td = { padding: "8px 6px", borderBottom: "1px solid #f0f0f0", color: "#222" };
const tdNum = { ...td, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };
