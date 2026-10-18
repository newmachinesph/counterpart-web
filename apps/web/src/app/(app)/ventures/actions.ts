"use server";

import { requireRole } from "@/lib/auth/session";
import { createVenture, publishVenture, unpublishVenture } from "@/lib/services/ventures";
import { fieldErrors, linesToList, ventureSchema, type FieldErrors } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function publishAction(formData: FormData) {
  const user = await requireRole("builder", "/ventures");
  const ventureId = String(formData.get("ventureId") ?? "");
  try {
    await publishVenture(user, ventureId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    redirect(`/ventures?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/ventures");
  revalidatePath("/bench");
  redirect("/ventures");
}

export async function unpublishAction(formData: FormData) {
  const user = await requireRole("builder", "/ventures");
  (await unpublishVenture(user, String(formData.get("ventureId") ?? "")));
  revalidatePath("/ventures");
  revalidatePath("/bench");
  redirect("/ventures");
}

export interface VentureFormState {
  errors: FieldErrors;
  formError: string | null;
}

function milestoneRows(formData: FormData) {
  const get = (name: string) => formData.getAll(name).map(String);
  const titles = get("ms_title");
  return titles
    .map((title, i) => ({
      title,
      metricKey: get("ms_metricKey")[i] ?? "",
      metricLabel: get("ms_metricLabel")[i] ?? "",
      unit: get("ms_unit")[i] ?? "count",
      aggregation: get("ms_aggregation")[i] ?? "latest",
      targetValue: get("ms_targetValue")[i] ?? "",
      tranchePct: get("ms_tranchePct")[i] ?? "",
      windowDays: get("ms_windowDays")[i] ?? "",
    }))
    .filter((r) => r.title.trim() || r.metricKey.trim() || r.targetValue.trim());
}

export async function createVentureAction(
  _prev: VentureFormState,
  formData: FormData,
): Promise<VentureFormState> {
  const user = await requireRole("builder", "/ventures/new");
  const parsed = ventureSchema.safeParse({
    commercialTerms: Object.fromEntries(["trialDays", "termDays", "monthlyFeePhp", "commissionRatePct", "paymentDays", "tailDays", "contractingParty", "eligibleRevenue", "attribution", "expensePolicy", "disputeProcess"].map(key => [key, formData.get(key)])),
    name: formData.get("name"),
    oneLiner: formData.get("oneLiner"),
    description: formData.get("description"),
    category: formData.get("category"),
    stage: formData.get("stage"),
    productUrl: formData.get("productUrl"),
    screenshots: linesToList(formData.get("screenshots")),
    logoUrl: formData.get("logoUrl") || null,
    tractionSummary: formData.get("tractionSummary"),
    equityMinPct: formData.get("equityMinPct"),
    equityMaxPct: formData.get("equityMaxPct"),
    hoursPerWeek: formData.get("hoursPerWeek"),
    builderHasDone: linesToList(formData.get("builderHasDone")),
    counterpartWouldOwn: linesToList(formData.get("counterpartWouldOwn")),
    vestingTerms: formData.get("vestingTerms"),
    unitLabel: formData.get("unitLabel"),
    revenuePerUnitPhpMonthly: formData.get("revenuePerUnitPhpMonthly"),
    variableCostPerUnitPhpMonthly: formData.get("variableCostPerUnitPhpMonthly"),
    monthlyContributionPhp: formData.get("monthlyContributionPhp"),
    withinDays: formData.get("withinDays"),
    internsWelcome: formData.get("internsWelcome") === "on",
    milestones: milestoneRows(formData),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), formError: "Fix the fields marked below." };
  }
  let slug: string;
  try {
    slug = (await createVenture(user, parsed.data)).slug;
  } catch (error) {
    return { errors: {}, formError: error instanceof Error ? error.message : "Could not create." };
  }
  revalidatePath("/ventures");
  redirect(`/bench/${slug}`);
}
