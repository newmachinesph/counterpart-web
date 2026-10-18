"use server";

import { requireUser } from "@/lib/auth/session";
import { applyToOpening, createOpening, reviewJobApplication, setOpeningStatus, type JobReviewAction } from "@/lib/services/openings";
import { fieldErrors, jobApplicationSchema, linesToList, openingSchema, type FieldErrors } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./form-state";
import { api } from "@/lib/api/client";

export async function respondToJobAction(formData: FormData) {
  const id = String(formData.get("openingId") ?? "");
  const back = `/jobs/${encodeURIComponent(id)}`;
  await requireUser(back);
  let error = "";
  try {
    await api(`/job-applications/${encodeURIComponent(String(formData.get("applicationId")))}/respond`, { action: String(formData.get("action")), agreementHash: String(formData.get("agreementHash") ?? "") });
  } catch (e) { error = e instanceof Error ? e.message : "Could not respond"; }
  revalidatePath(back); revalidatePath("/dashboard");
  redirect(`${back}?${error ? `error=${encodeURIComponent(error)}` : "saved=1"}`);
}



function numberOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function applyToJobAction(openingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(`/jobs/${openingId}/apply`);
  const parsed = jobApplicationSchema.safeParse({
    evidence: formData.get("evidence"),
    proofLinks: linesToList(formData.get("proofLinks")),
    availableFrom: formData.get("availableFrom"),
    expectedSalaryPhpMonthly: formData.get("expectedSalaryPhpMonthly"),
    whyThisRole: formData.get("whyThisRole"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), formError: "Fix the fields marked below." };

  try {
    (await applyToOpening(user, openingId, parsed.data));
  } catch (error) {
    return { errors: {}, formError: error instanceof Error ? error.message : "Could not send that." };
  }
  revalidatePath(`/jobs/${openingId}`);
  redirect(`/jobs/${openingId}?applied=1`);
}

export async function postOpeningAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/jobs/new");
  const parsed = openingSchema.safeParse({
    ventureId: formData.get("ventureId"),
    title: formData.get("title"),
    team: formData.get("team"),
    type: formData.get("type"),
    arrangement: formData.get("arrangement"),
    location: formData.get("location"),
    summary: formData.get("summary"),
    responsibilities: linesToList(formData.get("responsibilities")),
    lookingFor: linesToList(formData.get("lookingFor")),
    compensationDetails: formData.get("compensationDetails"),
    salaryMinPhpMonthly: numberOrNull(formData.get("salaryMinPhpMonthly")),
    salaryMaxPhpMonthly: numberOrNull(formData.get("salaryMaxPhpMonthly")),
    equityPct: numberOrNull(formData.get("equityPct")),
    fundedBy: formData.get("fundedBy"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), formError: "Fix the fields marked below." };

  let id: string;
  try {
    id = (await createOpening(user, { ...parsed.data, ventureId: parsed.data.ventureId || null })).id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not post that.";
    const errors: FieldErrors = /ledger|funding|commission|pay range|equity/i.test(message) ? { fundedBy: message } : {};
    return { errors, formError: message };
  }
  revalidatePath("/jobs");
  redirect(`/jobs/${id}`);
}

export async function reviewJobAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const user = await requireUser(`/jobs/${openingId}/applicants`);
  const back = `/jobs/${openingId}/applicants`;
  try {
    (await reviewJobApplication(user, String(formData.get("applicationId") ?? ""), String(formData.get("action") ?? "") as JobReviewAction));
  } catch (error) {
    redirect(`${back}?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not update")}`);
  }
  revalidatePath(back);
  redirect(back);
}

export async function setOpeningStatusAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const user = await requireUser(`/jobs/${openingId}`);
  const status = String(formData.get("status") ?? "") as "open" | "closed" | "filled";
  try {
    (await setOpeningStatus(user, openingId, status));
  } catch (error) {
    redirect(`/jobs/${openingId}/applicants?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not update")}`);
  }
  revalidatePath(`/jobs/${openingId}`);
  redirect(`/jobs/${openingId}/applicants`);
}
