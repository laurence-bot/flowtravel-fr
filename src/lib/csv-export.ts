/**
 * Utilitaires d'export CSV au format français (séparateur ;, BOM UTF-8 pour Excel,
 * dates JJ/MM/AAAA, montants avec virgule décimale).
 */

const BOM = "\uFEFF";

export function formatDateFR(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatNumberFR(value: number | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(digits).replace(".", ",");
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Échapper guillemets, retours ligne et le séparateur ;
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const sep = ";";
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(sep));
  for (const r of rows) {
    lines.push(r.map(escapeCell).join(sep));
  }
  return BOM + lines.join("\r\n");
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
