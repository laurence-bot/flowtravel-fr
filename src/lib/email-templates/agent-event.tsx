import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  agent_prenom?: string;
  event_label?: string;
  client_nom?: string;
  titre?: string;
  details?: string;
  link_url?: string;
  cta_label?: string;
}

const AgentEventEmail = ({ agent_prenom, event_label, client_nom, titre, details, link_url, cta_label }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>{event_label ?? "Nouvel évènement client"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bonjour {agent_prenom ?? ""},</Heading>
        <Text style={text}>
          <strong>{event_label ?? "Nouvel évènement"}</strong> sur le dossier{" "}
          <strong>{titre ?? ""}</strong>
          {client_nom ? <> — client <strong>{client_nom}</strong></> : null}.
        </Text>
        {details && <Text style={text}>{details}</Text>}
        {link_url && (
          <Button href={link_url} style={btn}>
            {cta_label ?? "Ouvrir le dossier"}
          </Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>FlowTravel — notification automatique</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: AgentEventEmail,
  subject: (d: Record<string, any>) =>
    `${d.event_label ?? "Nouvel évènement"} — ${d.titre ?? "Dossier"}`,
  displayName: "Notification agent (évènement client)",
  previewData: {
    agent_prenom: "Camille",
    event_label: "Acompte 1 reçu",
    client_nom: "Marie Dupont",
    titre: "Safari Tanzanie",
    details: "Vous pouvez maintenant envoyer le bulletin d'inscription.",
    link_url: "https://example.com/dossiers/abc",
    cta_label: "Ouvrir le dossier",
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
