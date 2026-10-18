import type { PairingState, VentureCategory, VentureStage } from "@/lib/domain/types";

const php = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});
const count = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export function formatPhp(value: number): string {
  return php.format(value);
}

export function formatMoney(value: number | string): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export function formatCount(value: number): string {
  return count.format(value);
}

export function formatMetric(value: number, unit: "php" | "count"): string {
  return unit === "php" ? formatPhp(value) : formatCount(value);
}

export function formatPct(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function toDate(iso: string): Date {
  return iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return toDate(iso).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return toDate(iso).toLocaleDateString("en-PH", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const CATEGORY_LABELS: Record<VentureCategory, string> = {
  loyalty: "Loyalty",
  fintech: "Fintech",
  saas: "SaaS",
  marketplace: "Marketplace",
  ecommerce: "E-commerce",
  logistics: "Logistics",
  other: "Other",
};

export const STAGE_LABELS: Record<VentureStage, string> = {
  development: "In development",
  live: "Live, pre-revenue",
  first_revenue: "First revenue",
  growing: "Growing",
};

export const PAIRING_STATE_LABELS: Record<PairingState, string> = {
  offered: "Offer pending", declined: "Offer declined", cofounder: "Cofounder",
  proving_run: "Proving run",
  active: "Active",
  released: "Released",
  lapsed: "Lapsed",
  completed: "Completed",
};

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}
