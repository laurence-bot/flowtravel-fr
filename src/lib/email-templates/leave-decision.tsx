import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { prenom?: string; date_debut?: string; date_fin?: string; statut?: "approuvee" | "refusee"; motif_refus?: string; sign_url?: string; }

const LeaveDecisionEmail = ({ prenom, date_debut, date_fin, statut, motif_refus, sign_url }: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Demande de congé {statut === "approuvee" ? "approuvée" : "refusée"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bonjour {prenom ?? ""}</Heading>
        <Text style={text}>
          Votre demande de congé du <strong>{date_debut}</strong> au <strong>{date_fin}</strong> a été <strong>{statut === "approuvee" ? "approuvée" : "refusée"}</strong>.
        </Text>
        {statut === "refusee" && motif_refus && <Text style={text}>Motif : {motif_refus}</Text>}
        {statut === "approuvee" && sign_url && (
          <Text style={text}>Merci de signer électroniquement la confirmation : <a href={sign_url}>{sign_url}</a></Text>
        )}
        <Text style={footer}>Flow Travel HR</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: LeaveDecisionEmail,
  subject: (d: Record<string, any>) => `Congé ${d.statut === "approuvee" ? "approuvé" : "refusé"}`,
  displayName: "Décision congé",
  previewData: { prenom: "Jane", date_debut: "2026-05-12", date_fin: "2026-05-16", statut: "approuvee", sign_url: "https://example.com" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", color: "#0B0B0B", margin: "0 0 16px" };
const text = { fontSize: "14px", color: "#3a3a3a", lineHeight: "1.6", margin: "0 0 16px" };
const footer = { fontSize: "11px", color: "#999", marginTop: "24px" };
