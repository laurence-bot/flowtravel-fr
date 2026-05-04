// Anti-doublons globaux (lignes fournisseurs et couvertures de change).
// Utilisé par les imports (PDF, capture, manuel) et toute UI d'ajout.
// La décision finale (REMPLACER / IGNORER / AJOUTER_QUAND_MEME) est laissée à l'UI.

export interface LigneFournisseurDedup {
  id?: string;
  fournisseur: string;
  libelle: string;
  montant: number;
  devise: string;
  unite?: string;
}

export interface LigneCouvertureDedup {
  id?: string;
  fournisseur: string;
  montantDevise: number;
  devise: string;
  tauxCouverture?: number;
  montantEuros?: number;
}

export type ActionDoublon = "REMPLACER" | "IGNORER" | "AJOUTER_QUAND_MEME";

function normaliser(str: string | null | undefined): string {
  return (str ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ---------- Fournisseurs ----------

export function estDoublonFournisseur(
  nouvelle: LigneFournisseurDedup,
  existantes: LigneFournisseurDedup[],
): { doublon: boolean; ligneExistante: LigneFournisseurDedup | null } {
  const match = existantes.find(
    (e) =>
      normaliser(e.fournisseur) === normaliser(nouvelle.fournisseur) &&
      normaliser(e.libelle) === normaliser(nouvelle.libelle) &&
      e.montant === nouvelle.montant &&
      normaliser(e.devise) === normaliser(nouvelle.devise),
  );
  return { doublon: !!match, ligneExistante: match ?? null };
}

export function tenterAjoutFournisseur(
  nouvelle: LigneFournisseurDedup,
  existantes: LigneFournisseurDedup[],
): {
  action: ActionDoublon | "OK";
  message: string | null;
  ligneExistante: LigneFournisseurDedup | null;
} {
  const { doublon, ligneExistante } = estDoublonFournisseur(nouvelle, existantes);
  if (!doublon) return { action: "OK", message: null, ligneExistante: null };
  return {
    action: "REMPLACER",
    message: `⚠️ Cette ligne existe déjà :\n"${ligneExistante!.libelle}" — ${ligneExistante!.montant} ${ligneExistante!.devise}\nVoulez-vous la remplacer ou l'ignorer ?`,
    ligneExistante,
  };
}

export function supprimerDoublonsFournisseurs<T extends LigneFournisseurDedup>(lignes: T[]): T[] {
  const vues = new Set<string>();
  return lignes.filter((l) => {
    const k = `${normaliser(l.fournisseur)}|${normaliser(l.libelle)}|${l.montant}|${normaliser(l.devise)}`;
    if (vues.has(k)) return false;
    vues.add(k);
    return true;
  });
}

// ---------- Couvertures de change ----------

export function estDoublonCouverture(
  nouvelle: LigneCouvertureDedup,
  existantes: LigneCouvertureDedup[],
): { doublon: boolean; ligneExistante: LigneCouvertureDedup | null } {
  const match = existantes.find(
    (e) =>
      normaliser(e.fournisseur) === normaliser(nouvelle.fournisseur) &&
      e.montantDevise === nouvelle.montantDevise &&
      normaliser(e.devise) === normaliser(nouvelle.devise),
  );
  return { doublon: !!match, ligneExistante: match ?? null };
}

export function tenterAjoutCouverture(
  nouvelle: LigneCouvertureDedup,
  existantes: LigneCouvertureDedup[],
): {
  action: ActionDoublon | "OK";
  message: string | null;
  ligneExistante: LigneCouvertureDedup | null;
} {
  const { doublon, ligneExistante } = estDoublonCouverture(nouvelle, existantes);
  if (!doublon) return { action: "OK", message: null, ligneExistante: null };
  return {
    action: "REMPLACER",
    message: `⚠️ Cette couverture existe déjà :\n${ligneExistante!.fournisseur} — ${ligneExistante!.montantDevise} ${ligneExistante!.devise}\nVoulez-vous la remplacer ou l'ignorer ?\n\n⚠️ Les doublons faussent les calculs de risque de change et le gain client.`,
    ligneExistante,
  };
}

export function supprimerDoublonsCouvertures<T extends LigneCouvertureDedup>(lignes: T[]): T[] {
  const vues = new Set<string>();
  return lignes.filter((l) => {
    const k = `${normaliser(l.fournisseur)}|${l.montantDevise}|${normaliser(l.devise)}`;
    if (vues.has(k)) return false;
    vues.add(k);
    return true;
  });
}
