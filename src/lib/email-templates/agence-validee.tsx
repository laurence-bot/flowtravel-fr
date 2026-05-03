import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import type { TemplateEntry } from './registry'

interface Props {
  agenceName: string
  loginUrl: string
  email: string
}

export function AgenceValideeEmail({ agenceName, loginUrl, email }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Votre compte FlowTravel est activé</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Inter, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
          <Heading style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 500, color: '#0B0B0B', margin: '0 0 8px' }}>
            FlowTravel
          </Heading>
          <Text style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A96E', margin: '0 0 32px' }}>
            Bienvenue à bord
          </Text>

          <Heading as="h2" style={{ fontSize: 22, fontWeight: 600, color: '#0B0B0B', margin: '0 0 16px' }}>
            Votre compte est activé, {agenceName}
          </Heading>

          <Text style={{ fontSize: 15, lineHeight: 1.6, color: '#333' }}>
            Bonne nouvelle : nous avons vérifié votre dossier (ATOUT FRANCE, Kbis, pièce d'identité)
            et activé votre espace administrateur FlowTravel.
          </Text>

          <Text style={{ fontSize: 15, lineHeight: 1.6, color: '#333' }}>
            Vous pouvez désormais vous connecter avec l'adresse <strong>{email}</strong> et le mot de
            passe que vous avez choisi à l'inscription.
          </Text>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Link
              href={loginUrl}
              style={{
                backgroundColor: '#0B0B0B',
                color: '#fff',
                padding: '14px 32px',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
                display: 'inline-block',
              }}
            >
              Accéder à mon espace
            </Link>
          </Section>

          <Text style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Première étape recommandée : compléter vos paramètres d'agence (logo, IBAN,
            CGV, marges) dans <em>Administration → Paramètres agence</em>.
          </Text>

          <Text style={{ fontSize: 12, color: '#999', marginTop: 40 }}>
            Si vous avez oublié votre mot de passe, utilisez le lien
            « Mot de passe oublié ? » sur la page de connexion.
          </Text>

          <Text style={{ fontSize: 11, color: '#aaa', marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
            FlowTravel — Travel Operating System
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: AgenceValideeEmail,
  subject: 'Votre compte FlowTravel est activé 🎉',
  displayName: 'Agence — compte activé',
  previewData: {
    agenceName: 'Maison Voyages',
    loginUrl: 'https://flowtravel.fr/auth',
    email: 'contact@maisonvoyages.fr',
  },
}
