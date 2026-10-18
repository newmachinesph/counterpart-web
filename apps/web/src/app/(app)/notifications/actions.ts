"use server";

import { requireUser } from "@/lib/auth/session";
import { markAllRead } from "@/lib/services/notifications";
import { revalidatePath } from "next/cache";

export async function markReadAction() {
  const user = await requireUser("/notifications");
  await markAllRead(user.id);
  revalidatePath("/", "layout");
}
