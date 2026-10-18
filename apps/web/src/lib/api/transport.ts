/** Metric keys and IDs inside maps are data, not field names. */
const MAP_FIELDS = new Set(["values", "applicant_counts", "applicantCounts", "job_applicant_counts", "jobApplicantCounts", "ledger_revenue", "ledgerRevenue"]);

export function transformKeys(value: unknown, direction: "camel" | "snake"): unknown {
  if (Array.isArray(value)) return value.map((v) => transformKeys(v, direction));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const converted = direction === "camel" ? key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) : key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    return [converted, MAP_FIELDS.has(key) ? child : transformKeys(child, direction)];
  }));
}
