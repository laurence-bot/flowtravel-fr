// Bank CSV import utilities — SG, CIC, Ebury

export type BankSource = "sg" | "cic" | "ebury";
export type BankSens = "credit" | "debit";

export type ParsedBankRow = {
  date: string; // ISO yyyy-mm-dd
  libelle_original: string;
  libelle_normalise: string;
  montant: number; // valeur absolue
  sens: BankSens;
  hash_unique: string;
};

export type ParseResult = {
  source: BankSource | null;
  rows: ParsedBankRow[];
  errors: string[];
};

// ---- Normalisation libellé ----
export function normalizeLibelle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Hash simple (FNV-1a 32-bit, hex) ----
export function hashRow(date: string, libelle: string, montant: number, sens: BankSens): string {
  const str = `${date}|${normalizeLibelle(libelle)}|${montant.toFixed(2)}|${sens}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ---- CSV split (gère guillemets, séparateurs ; ou , ou tab) ----
export function detectSeparator(sample: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = 0;
  for (const c of candidates) {
    const count = (sample.match(new RegExp(`\\${c}`, "g")) || []).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

export function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// ---- Parsing nombres FR (1 234,56 ou 1234.56) ----
export function parseAmount(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim().replace(/\s/g, "").replace(/\u00a0/g, "");
  // si contient virgule décimale -> retirer points (séparateurs milliers FR)
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

// ---- Parsing dates : dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd ----
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // FR
  const fr = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/);
  if (fr) {
    let yyyy = fr[3];
    if (yyyy.length === 2) yyyy = (parseInt(yyyy, 10) > 50 ? "19" : "20") + yyyy;
    return `${yyyy}-${fr[2]}-${fr[1]}`;
  }
  return null;
}

// ---- Détection banque depuis l'en-tête ----
export function detectBank(headers: string[]): BankSource | null {
  const h = headers.map((x) => x.toLowerCase());
  const joined = h.join("|");

  if (joined.includes("ebury")) return "ebury";
  // SG : colonnes typiques "Date opération", "Libellé", "Débit", "Crédit"
  if (h.some((c) => c.includes("débit")) && h.some((c) => c.includes("crédit"))) {
    if (joined.includes("operation") || joined.includes("opération")) return "sg";
    return "cic";
  }
  // CIC : "Date opération;Date valeur;Montant;Libellé"
  if (h.some((c) => c.includes("montant")) && h.some((c) => c.includes("libellé") || c.includes("libelle"))) {
    return "cic";
  }
  // Ebury : "Date;Description;Amount;Currency"
  if (h.some((c) => c === "amount") && h.some((c) => c.includes("description"))) {
    return "ebury";
  }
  return null;
}

// ---- Trouver index d'une colonne par mots-clés ----
function findCol(headers: string[], keywords: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (let i = 0; i < lower.length; i++) {
    if (keywords.some((k) => lower[i].includes(k))) return i;
  }
  return -1;
}

// ---- Parsing principal ----
export function parseBankCsv(content: string, forcedSource?: BankSource): ParseResult {
  const errors: string[] = [];
  const rows: ParsedBankRow[] = [];

  const cleaned = content.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { source: null, rows: [], errors: ["Fichier vide ou sans données."] };
  }

  const sep = detectSeparator(lines[0]);
  const headers = parseCsvLine(lines[0], sep);
  const source = forcedSource ?? detectBank(headers);

  if (!source) {
    return {
      source: null,
      rows: [],
      errors: [
        "Format bancaire non reconnu. Sélectionnez la banque manuellement ou vérifiez l'en-tête du fichier.",
      ],
    };
  }

  const idxDate = findCol(headers, ["date opération", "date operation", "date"]);
  const idxLib = findCol(headers, ["libellé", "libelle", "description", "intitulé", "intitule"]);
  const idxDebit = findCol(headers, ["débit", "debit"]);
  const idxCredit = findCol(headers, ["crédit", "credit"]);
  const idxMontant = findCol(headers, ["montant", "amount"]);

  if (idxDate < 0) errors.push("Colonne date introuvable.");
  if (idxLib < 0) errors.push("Colonne libellé introuvable.");
  if (idxMontant < 0 && (idxDebit < 0 || idxCredit < 0)) {
    errors.push("Colonne montant (ou débit/crédit) introuvable.");
  }
  if (errors.length > 0) return { source, rows: [], errors };

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], sep);
    if (cells.length < 2) continue;

    const dateRaw = cells[idxDate] ?? "";
    const date = parseDate(dateRaw);
    if (!date) {
      errors.push(`Ligne ${i + 1} : date invalide ("${dateRaw}").`);
      continue;
    }

    const libelle = cells[idxLib] ?? "";
    if (!libelle) {
      errors.push(`Ligne ${i + 1} : libellé manquant.`);
      continue;
    }

    let montant = NaN;
    let sens: BankSens = "credit";

    if (idxMontant >= 0) {
      montant = parseAmount(cells[idxMontant] ?? "");
      if (isNaN(montant)) {
        errors.push(`Ligne ${i + 1} : montant invalide.`);
        continue;
      }
      sens = montant >= 0 ? "credit" : "debit";
      montant = Math.abs(montant);
    } else {
      const d = parseAmount(cells[idxDebit] ?? "");
      const c = parseAmount(cells[idxCredit] ?? "");
      if (!isNaN(c) && c > 0) {
        montant = c;
        sens = "credit";
      } else if (!isNaN(d) && d > 0) {
        montant = d;
        sens = "debit";
      } else {
        errors.push(`Ligne ${i + 1} : aucun montant détecté.`);
        continue;
      }
    }

    if (montant === 0) continue;

    rows.push({
      date,
      libelle_original: libelle,
      libelle_normalise: normalizeLibelle(libelle),
      montant,
      sens,
      hash_unique: hashRow(date, libelle, montant, sens),
    });
  }

  return { source, rows, errors };
}
