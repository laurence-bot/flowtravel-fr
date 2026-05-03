import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { prenom?: string; titre?: string; sign_url?: string; }

const ContractToSignEmail = ({ prenom, titre, sign_url }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Un contrat est à signer</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bonjour {prenom ?? ""}</Heading>
        <Text style={text}>Un nouveau document RH est prêt à être signé : <strong>{titre ?? "Contrat"}</strong>.</Text>
        {sign_url && <Button href={sign_url} style={btn}>Signer le document</Button>}
        <Text style={footer}>Lien personnel — ne le transférez pas.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: ContractToSignEmail,
  subject: "Document à signer",
  displayName: "Contrat à signer",
  previewData: { prenom: "Jane", titre: "CDI - Conseillère voyages", sign_url: "https://example.com" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", color: "#0B0B0B", margin: "0 0 16px" };
const text = { fontSize: "14px", color: "#3a3a3a", lineHeight: "1.6", margin: "0 0 20px" };
const btn = { backgroundColor: "#0B0B0B", color: "#fff", padding: "12px 22px", borderRadius: "6px", textDecoration: "none", fontSize: "14px" };
const footer = { fontSize: "11px", color: "#999", marginTop: "24px" };
