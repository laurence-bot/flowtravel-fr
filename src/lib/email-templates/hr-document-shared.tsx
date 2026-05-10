import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  prenom?: string;
  categorie_label?: string;
  titre?: string;
  description?: string | null;
  pdf_url?: string;
  espace_url?: string;
  agence_nom?: string;
}

const HrDocumentSharedEmail = ({ prenom, categorie_label, titre, description, pdf_url, espace_url, agence_nom }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>{categorie_label ?? "Nouveau document"} disponible — {titre}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bonjour {prenom ?? ""},</Heading>
        <Text style={text}>
          {agence_nom ?? "Votre employeur"} vient de mettre à votre disposition un nouveau document
          {categorie_label ? ` (${categorie_label.toLowerCase()})` : ""} :
          <br />
          <strong>{titre}</strong>
        </Text>
        {description && <Text style={text}>{description}</Text>}
        {pdf_url && (
          <Button href={pdf_url} style={btn}>
            Télécharger le document (PDF)
          </Button>
        )}
        {espace_url && (
          <Text style={text}>
            Vous retrouvez aussi tous vos documents RH dans votre espace personnel : <a href={espace_url}>{espace_url}</a>
          </Text>
        )}
        <Text style={footer}>Email automatique — merci de ne pas y répondre directement.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: HrDocumentSharedEmail,
  subject: (d: Record<string, any>) =>
    `${d.categorie_label ?? "Nouveau document"} — ${d.titre ?? ""}`.trim(),
  displayName: "Document RH partagé à l'employé",
  previewData: {
    prenom: "Lisa",
    categorie_label: "Bulletin de paie",
    titre: "Bulletin de paie — Mai 2026",
    description: null,
    pdf_url: "https://example.com/bulletin.pdf",
    espace_url: "https://example.com/mon-espace/documents",
    agence_nom: "Flow Travel",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const h1 = { fontSize: "20px", color: "#0B0B0B", margin: "0 0 16px" };
const text = { fontSize: "14px", color: "#3a3a3a", lineHeight: "1.6", margin: "0 0 14px" };
const btn = { backgroundColor: "#0B0B0B", color: "#fff", padding: "12px 20px", borderRadius: "6px", fontSize: "14px", textDecoration: "none", display: "inline-block", margin: "8px 0 16px" };
const footer = { fontSize: "11px", color: "#999", marginTop: "24px" };
