export const formatEUR = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
};

export const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
};
