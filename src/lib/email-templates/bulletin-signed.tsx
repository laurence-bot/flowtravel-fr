import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr, Section } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface InvoiceRow { numero: string; type: string; montant_ttc: number; }
interface Props {
  prenom?: string;
  titre?: string;
  agence?: string;
  bulletin_url?: string;
  factures_url?: string;
  factures?: InvoiceRow[];
}

const TYPE_LABEL: Record<string, string> = {
  acompte_1: "Acompte 1",
  acompte_2: "Acompte 2",
  solde: "Solde",
  globale: "Facture",
};

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const BulletinSignedEmail = ({ prenom, titre, agence, bulletin_url, factures_url, factures }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Votre bulletin signé et vos factures sont disponibles</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Merci {prenom ?? ""} 🌿</Heading>
        <Text style={text}>
          Votre bulletin d'inscription pour <strong>{titre ?? "votre voyage"}</strong> a bien
          été signé. Votre réservation est désormais confirmée.
        </Text>
        <Text style={text}>
          Vous trouverez ci-dessous l'accès à votre bulletin signé ainsi qu'à vos factures.
        </Text>

        {bulletin_url && (
          <Button href={bulletin_url} style={btnPrimary}>
            Voir mon bulletin signé
          </Button>
        )}

        {factures && factures.length > 0 && (
          <Section style={{ marginTop: 28 }}>
            <Heading as="h2" style={h2}>Vos factures</Heading>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {factures.map((f) => (
                  <tr key={f.numero}>
                    <td style={tdLeft}>
                      <div style={{ fontFamily: "monospace" }}>{f.numero}</div>
                      <div style={{ color: "#888", fontSize: 11 }}>{TYPE_LABEL[f.type] ?? f.type}</div>
                    </td>
                    <td style={tdRight}>{fmtEUR(Number(f.montant_ttc))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {factures_url && (
              <Button href={factures_url} style={btnGhost}>
                Accéder à mes factures
              </Button>
            )}
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          {agence ?? "Votre agence"} — conservez précieusement ces documents.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: BulletinSignedEmail,
  subject: (d: Record<string, any>) => `Votre bulletin signé — ${d.titre ?? "Voyage"}`,
  displayName: "Bulletin signé + factures",
  previewData: {
    prenom: "Marie",
    titre: "Safari Tanzanie",
    agence: "Flow Travel",
    bulletin_url: "https://example.com/bulletin/abc",
    factures_url: "https://example.com/mes-factures/abc",
    factures: [
      { numero: "FA-2026-0001", type: "acompte_1", montant_ttc: 1200 },
      { numero: "FA-2026-0002", type: "solde", montant_ttc: 2800 },
    ],
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "600px" };
const h1 = { fontSize: "24px", color: "#0B0B0B", margin: "0 0 16px" };
const h2 = { fontSize: "16px", color: "#0B0B0B", margin: "0 0 12px" };
const text = { fontSize: "14px", color: "#3a3a3a", lineHeight: "1.6", margin: "0 0 18px" };
const btnPrimary = {
  backgroundColor: "#0B0B0B", color: "#fff", padding: "14px 26px",
  borderRadius: "4px", textDecoration: "none", fontSize: "14px",
  letterSpacing: "0.05em", textTransform: "uppercase" as const, display: "inline-block",
};
const btnGhost = {
  ...btnPrimary, backgroundColor: "#fff", color: "#0B0B0B",
  border: "1px solid #0B0B0B", marginTop: 16,
};
const tdLeft = { padding: "10px 0", borderBottom: "1px solid #eee", textAlign: "left" as const };
const tdRight = { padding: "10px 0", borderBottom: "1px solid #eee", textAlign: "right" as const, fontWeight: 600 };
const hr = { borderColor: "#e5e5e5", margin: "32px 0 16px" };
const footer = { fontSize: "11px", color: "#999", margin: "0" };
