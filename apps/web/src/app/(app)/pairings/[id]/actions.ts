"use server";

import { requireUser } from "@/lib/auth/session";
import { commentOnEntry, logWeek } from "@/lib/services/ledger";
import { endPairing, getPairing, requestReview } from "@/lib/services/pairings";
import { getVentureById } from "@/lib/services/ventures";
import { fieldErrors, linesToList, logWeekSchema, type FieldErrors } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface LogState {
  errors: FieldErrors;
  formError: string | null;
}

export async function logWeekAction(
  pairingId: string,
  _prev: LogState,
  formData: FormData,
): Promise<LogState> {
  const user = await requireUser(`/pairings/${pairingId}/log`);
  const pairing = (await getPairing(pairingId));
  const venture = pairing ? (await getVentureById(pairing.ventureId)) : null;
  if (!pairing || !venture) return { errors: {}, formError: "Pairing not found." };

  const values: Record<string, unknown> = {};
  for (const metric of venture.metrics) {
    values[metric.key] = formData.get(`value_${metric.key}`);
  }
  const parsed = logWeekSchema.safeParse({
    weekStarting: formData.get("weekStarting"),
    values,
    note: formData.get("note") ?? "",
    evidenceLinks: linesToList(formData.get("evidenceLinks")),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), formError: "Fix the fields marked below." };
  }
  try {
    (await logWeek(user, pairingId, parsed.data));
  } catch (error) {
    return { errors: {}, formError: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath(`/pairings/${pairingId}`);
  redirect(`/pairings/${pairingId}?logged=1`);
}

export async function commentAction(formData: FormData) {
  const pairingId = String(formData.get("pairingId") ?? "");
  const user = await requireUser(`/pairings/${pairingId}`);
  const entryId = String(formData.get("entryId") ?? "");
  const body = String(formData.get("body") ?? "");
  try {
    (await commentOnEntry(user, entryId, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not comment";
    redirect(`/pairings/${pairingId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/pairings/${pairingId}`);
  redirect(`/pairings/${pairingId}#ledger`);
}

export async function endPairingAction(formData: FormData) {
  const pairingId = String(formData.get("pairingId") ?? "");
  const user = await requireUser(`/pairings/${pairingId}`);
  const reason = String(formData.get("reason") ?? "");
  try {
    (await endPairing(user, pairingId, reason));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not end the pairing";
    redirect(`/pairings/${pairingId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/pairings/${pairingId}`);
  revalidatePath("/pairings");
  revalidatePath("/bench");
  redirect(`/pairings/${pairingId}`);
}

export async function requestReviewAction(formData: FormData) {
  const pairingId = String(formData.get("pairingId") ?? "");
  const user = await requireUser(`/pairings/${pairingId}/review`);
  const message = String(formData.get("message") ?? "");
  try {
    (await requestReview(user, pairingId, message));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not send";
    redirect(`/pairings/${pairingId}/review?error=${encodeURIComponent(detail)}`);
  }
  revalidatePath(`/pairings/${pairingId}`);
  redirect(`/pairings/${pairingId}?reviewed=1`);
}