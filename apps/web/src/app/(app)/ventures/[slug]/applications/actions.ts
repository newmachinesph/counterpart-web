"use server";

import { requireRole } from "@/lib/auth/session";
import { reviewApplication, type ReviewAction } from "@/lib/services/applications";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ACTIONS: ReviewAction[] = ["shortlist", "decline", "invite"];

export async function reviewAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const user = await requireRole("builder", `/ventures/${slug}/applications`);
  const applicationId = String(formData.get("applicationId") ?? "");
  const action = String(formData.get("action") ?? "") as ReviewAction;
  const back = `/ventures/${slug}/applications`;
  if (!ACTIONS.includes(action)) redirect(`${back}?error=Unknown%20action`);

  try {
    (await reviewApplication(user, applicationId, action));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(back);
  revalidatePath("/bench");
  revalidatePath("/pairings");
  redirect(back);
}