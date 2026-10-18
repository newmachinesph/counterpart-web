"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/session";
import type { OperationsFormState } from "@/lib/operations";

export async function submitRequest(_previous: OperationsFormState, form: FormData): Promise<OperationsFormState> {
  await requireUser("/support");
  let id: string;
  try {
    const row = await api<{ id: string }>("/support/requests", {
      category: form.get("category"), subject: form.get("subject"), message: form.get("message"),
      ventureSlug: form.get("category") === "listing" ? String(form.get("ventureSlug") ?? "").trim() : null,
    });
    id = row.id;
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not send your request." }; }
  revalidatePath("/support");
  revalidatePath("/admin");
  redirect(`/support?sent=${encodeURIComponent(id)}`);
}
