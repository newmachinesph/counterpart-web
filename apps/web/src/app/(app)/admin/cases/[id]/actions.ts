"use server";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import type { OperationsFormState } from "@/lib/operations";

export async function updateCase(id: string, version: number, _previous: OperationsFormState, form: FormData): Promise<OperationsFormState> {
  await requireRole("admin", `/admin/cases/${id}`);
  try {
    await api(`/admin/cases/${encodeURIComponent(id)}`, {
      version, action: form.get("action"), note: form.get("note") || "",
      assignedTo: form.get("assignedTo") || null,
    });
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not save this update." }; }
  revalidatePath("/admin");
  revalidatePath(`/admin/cases/${id}`);
  revalidatePath("/support");
  return { success: "Update recorded." };
}
