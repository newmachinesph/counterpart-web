import type { FieldErrors } from "@/lib/validation";

/** Shared shape for the job forms. Kept out of the "use server" module, which
 * may only export async functions. */
export interface FormState {
  errors: FieldErrors;
  formError: string | null;
}

export const EMPTY: FormState = { errors: {}, formError: null };