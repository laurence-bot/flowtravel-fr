import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  prenom?: string;
  titre?: string;
  agence?: string;
  payment_url?: string;
  montant_acompte?: string;
}

const AcompteRelanceEmail = ({ prenom, titre, agence, payment_url, montant_acompte }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Rappel — paiement de votre acompte pour {titre ?? "votre voyage"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bonjour {prenom ?? ""},</Heading>
        <Text style={text}>
          Vous avez validé votre voyage <strong>{titre ?? ""}</strong>, et nous vous en remercions !
        </Text>
        <Text style={text}>
          Nous n'avons pas encore reçu votre <strong>acompte{montant_acompte ? ` de ${montant_acompte}` : ""}</strong>.
          Pour sécuriser votre réservation et lancer la préparation, merci de procéder au règlement.
        </Text>
        {payment_url && (
          <Button href={payment_url} style={btn}>Voir les modes de paiement</Button>
        )}
        <Text style={text}>
          Si vous avez déjà effectué le paiement, vous pouvez nous le signaler depuis cette même page
          en cliquant sur « J'ai effectué le paiement ».
        </Text>
        <Hr style={hr} />
        <Text style={footer}>{agence ?? "Votre agence"}</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: AcompteRelanceEmail,
  subject: (d: Record<string, any>) =>
    `Rappel — paiement de l'acompte (${d.titre ?? "Voyage"})`,
  displayName: "Acompte — relance paiement",
  previewData: {
    prenom: "Marie",
    titre: "Safari Tanzanie",
    agence: "Flow Travel",
    payment_url: "https://example.com/paiement/abc",
    montant_acompte: "1 200 €",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", color: "#0B0B0B", margin: "0 0 16px" };
const text = { fontSize: "14px", color: "#3a3a3a", lineHeight: "1.6", margin: "0 0 20px" };
const btn = {
  backgroundColor: "#0B0B0B",
  color: "#fff",
  padding: "14px 26px",
  borderRadius: "4px",
  textDecoration: "none",
  fontSize: "14px",
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  display: "inline-block",
};
const hr = { borderColor: "#e5e5e5", margin: "28px 0" };
const footer = { fontSize: "11px", color: "#999", margin: "0" };
