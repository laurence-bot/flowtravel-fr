export const formatEUR = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
};

export const formatPercent = (value: number | null | undefined, digits = 1) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)} %`;
};

export const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
};
