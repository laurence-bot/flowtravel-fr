import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  prenom?: string;
  titre?: string;
  agence?: string;
  sign_url?: string;
}

const BulletinToSignEmail = ({ prenom, titre, agence, sign_url }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Votre bulletin d'inscription est prêt à être signé</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bonjour {prenom ?? ""},</Heading>
        <Text style={text}>
          Votre acompte pour le voyage <strong>{titre ?? ""}</strong> a bien été enregistré.
          Pour confirmer définitivement votre réservation, merci de signer en ligne votre
          bulletin d'inscription.
        </Text>
        {sign_url && (
          <Button href={sign_url} style={btn}>
            Signer mon bulletin d'inscription
          </Button>
        )}
        <Text style={text}>
          Une fois signé, vous recevrez par email une copie du bulletin signé ainsi que
          la facture de votre acompte.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          {agence ?? "Votre agence"} — lien personnel, ne le transférez pas.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: BulletinToSignEmail,
  subject: (d: Record<string, any>) =>
    `Votre bulletin d'inscription — ${d.titre ?? "Voyage"}`,
  displayName: "Bulletin d'inscription à signer",
  previewData: {
    prenom: "Marie",
    titre: "Safari Tanzanie & Zanzibar",
    agence: "Flow Travel",
    sign_url: "https://example.com/bulletin/abc123",
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
