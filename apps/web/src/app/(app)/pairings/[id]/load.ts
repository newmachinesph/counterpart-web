import type { User } from "@/lib/domain/types";
import { ForbiddenError, NotFoundError } from "@/lib/services/ids";
import { getDashboard, type PairingDashboard } from "@/lib/services/pairings";
import { notFound } from "next/navigation";

/** Loads the dashboard or 404s. A pairing you cannot see does not exist for you. */
export async function loadDashboardOr404(user: User, id: string, now = new Date()): Promise<PairingDashboard> {
  try {
    return (await getDashboard(user, id, now));
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }
}