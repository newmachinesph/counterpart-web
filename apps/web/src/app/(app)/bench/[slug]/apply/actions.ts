"use server";

import { requireRole } from "@/lib/auth/session";
import { submitApplication } from "@/lib/services/applications";
import { getVentureBySlug } from "@/lib/services/ventures";
import { applicationSchema, fieldErrors, linesToList, type FieldErrors } from "@/lib/validation";
import { redirect } from "next/navigation";

export interface ApplyState {
  errors: FieldErrors;
  formError: string | null;
}

function rows(formData: FormData) {
  const metric = formData.getAll("nm_metric").map(String);
  const before = formData.getAll("nm_before").map(String);
  const after = formData.getAll("nm_after").map(String);
  const timeframe = formData.getAll("nm_timeframe").map(String);
  return metric
    .map((m, i) => ({ metric: m, before: before[i] ?? "", after: after[i] ?? "", timeframe: timeframe[i] ?? "" }))
    .filter((r) => r.metric.trim() || r.before.trim() || r.after.trim() || r.timeframe.trim());
}

export async function submitApplicationAction(slug: string, _prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const user = await requireRole("counterpart", `/bench/${slug}/apply`);
  const venture = (await getVentureBySlug(slug));
  if (!venture) return { errors: {}, formError: "This venture no longer exists." };

  const parsed = applicationSchema.safeParse({
    evidence: formData.get("evidence"),
    proofLinks: linesToList(formData.get("proofLinks")),
    numbersMoved: rows(formData),
    hoursPerWeek: formData.get("hoursPerWeek"),
    compensation: formData.get("compensation"),
    track: formData.get("track"),
    requestedEquityPct: formData.get("requestedEquityPct"),
    templateId: formData.get("templateId"),
    commitments: linesToList(formData.get("commitments")),
    acknowledgesResourceClause: formData.get("acknowledgesResourceClause") === "on",
    whyThisVenture: formData.get("whyThisVenture"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), formError: "Fix the fields marked below." };
  }

  try {
    (await submitApplication(user, venture, parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit.";
    const errors: FieldErrors = /resources|clause/i.test(message) ? { acknowledgesResourceClause: message } : /offers|cap|tranche|structure|track|interns/i.test(message) ? { requestedEquityPct: message } : {};
    return { errors, formError: message };
  }
  redirect(`/bench/${slug}?applied=1`);
}