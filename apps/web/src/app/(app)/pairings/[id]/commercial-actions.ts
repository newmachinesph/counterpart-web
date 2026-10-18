"use server";
import { api } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function commercialAction(form: FormData) {
 const id = String(form.get("pairingId") ?? "");
 const kind = String(form.get("kind") ?? "");
 const record = encodeURIComponent(String(form.get("recordId") ?? ""));
 const target = kind === "agreement" ? `/pairings/${id}/agreement` : `/pairings/${id}/compensation`;
 await requireUser(target);
 const str = (key: string) => String(form.get(key) ?? "");
 const num = (key: string) => Number(form.get(key));
 let error = "";
 try {
 let path = `/pairings/${encodeURIComponent(id)}/`;
 let body: unknown;
 const action = {action: str("action"), agreementHash: str("agreementHash"), note: str("note")};
 if (kind === "agreement") { path += "agreement"; body = action; }
 else if (kind === "deal") { path += "deals"; body = {reference: str("reference"), evidence: str("evidence")}; }
 else if (kind === "claim") { path += "claims"; body = {kind: str("claimKind"), reference: str("reference"), dealId: str("dealId") || null, collectedAt: str("collectedAt") ? new Date(str("collectedAt") + "Z").toISOString() : null, eligibleRevenuePhp: str("eligibleRevenuePhp") || "0", evidence: str("evidence"), feeMonth: str("feeMonth") || null}; }
 else if (kind === "claim-action") { path = `/claims/${record}/action`; body = action; }
 else if (kind === "case") { path = `/review-cases/${record}/resolve`; body = action; }
 else if (kind === "grant-action") { path = `/grants/${record}/action`; body = action; }
 else if (kind === "grant") { path += "grants"; body = {entity: str("entity"), shareClass: str("shareClass"), grantUnits: num("grantUnits"), capitalizationUnits: num("capitalizationUnits"), vestingStart: new Date(str("vestingStart") + "Z").toISOString(), vestingMonths: num("vestingMonths"), cliffMonths: num("cliffMonths"), signedDocumentUrl: str("signedDocumentUrl"), approvalReference: str("approvalReference"), departureTerms: str("departureTerms"), confirmsAuthorityAndReview: form.get("confirmsAuthorityAndReview") === "on"}; }
 else throw new Error("Unknown action");
 await api(path, body); } catch (e) { error = e instanceof Error ? e.message : "Could not save"; }
 revalidatePath("/pairings"); revalidatePath(`/pairings/${id}`); revalidatePath(target);
 redirect(`${target}?${error ? `error=${encodeURIComponent(error)}` : "saved=1"}`);
}
