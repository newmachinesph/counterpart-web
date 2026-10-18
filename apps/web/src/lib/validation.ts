import { z } from "zod";
import { OPENING_TYPES, VENTURE_CATEGORIES, VENTURE_STAGES, WORK_ARRANGEMENTS } from "@/lib/domain/types";

/* Zod schemas for form input at the boundary. Services re-check the rules. */

export const urlSchema = z
  .string()
  .trim()
  .url("Enter a full URL, starting with http:// or https://");

export function linesToList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const applicationSchema = z.object({
  evidence: z
    .string()
    .trim()
    .min(200, "Write at least 200 characters. Specifics, not adjectives."),
  proofLinks: z.array(urlSchema).min(1, "Add at least one link that shows the work."),
  numbersMoved: z
    .array(
      z.object({
        metric: z.string().trim().min(1, "Name the metric"),
        before: z.string().trim().min(1, "Required"),
        after: z.string().trim().min(1, "Required"),
        timeframe: z.string().trim().min(1, "Required"),
      }),
    )
    .min(1, "Add at least one number you personally moved."),
  hoursPerWeek: z.coerce.number().int().min(1, "At least 1 hour").max(80, "Be realistic"),
  compensation: z.literal("cash"),
  track: z.literal("counterpart"),
  requestedEquityPct: z.coerce.number().min(0).max(0),
  templateId: z.literal("operator_v1"),
  commitments: z.array(z.string()),
  acknowledgesResourceClause: z.boolean(),
  whyThisVenture: z.string().trim().min(20, "Say why this one, in a few sentences."),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;

export const logWeekSchema = z.object({
  weekStarting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a week"),
  values: z.record(z.string(), z.coerce.number().min(0, "Cannot be negative")),
  note: z.string().trim().max(1000, "Keep the note under 1000 characters"),
  evidenceLinks: z.array(urlSchema),
});

const milestoneInputSchema = z.object({
  title: z.string().trim().min(1, "Title required"),
  metricKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/, "Lowercase letters, digits, and underscores"),
  metricLabel: z.string().trim().min(1, "Label required"),
  unit: z.enum(["php", "count"]),
  aggregation: z.enum(["sum", "latest"]),
  targetValue: z.coerce.number().positive("Target must be above zero"),
  tranchePct: z.coerce.number().min(0).max(0),
  windowDays: z.coerce.number().int().positive("Window must be at least 1 day"),
});

export const commercialTermsSchema = z.object({
 trialDays: z.coerce.number().int().min(1).max(90), termDays: z.coerce.number().int().min(1).max(730),
 monthlyFeePhp: z.coerce.number().min(0).max(10000000), commissionRatePct: z.coerce.number().min(0).max(100),
 paymentDays: z.coerce.number().int().min(1).max(60), tailDays: z.coerce.number().int().min(0).max(365),
 contractingParty: z.string().trim().min(3), eligibleRevenue: z.string().trim().min(20), attribution: z.string().trim().min(20),
 expensePolicy: z.string().trim().min(10), disputeProcess: z.string().trim().min(20),
}).refine(v => v.monthlyFeePhp > 0 || v.commissionRatePct > 0, {message: "Agree a positive fee or commission", path: ["monthlyFeePhp"]})
.refine(v => v.termDays >= v.trialDays, {message: "The term must cover the trial", path: ["termDays"]});

export const ventureSchema = z
  .object({
    name: z.string().trim().min(2, "Name required"),
    oneLiner: z
      .string()
      .trim()
      .min(10, "One line, what it does")
      .max(140, "Keep it to 140 characters"),
    description: z.string().trim().min(50, "Describe what works today, in at least 50 characters"),
    category: z.enum(VENTURE_CATEGORIES),
    stage: z.enum(VENTURE_STAGES),
    productUrl: urlSchema,
    screenshots: z.array(urlSchema),
    logoUrl: urlSchema.nullable().optional(),
    tractionSummary: z.string().trim().min(1, "One line of real numbers"),
    commercialTerms: commercialTermsSchema,
    equityMinPct: z.coerce.number().min(0).max(0),
    equityMaxPct: z.coerce.number().min(0).max(0),
    hoursPerWeek: z.coerce.number().int().min(1).max(80),
    builderHasDone: z.array(z.string()).min(1, "List at least one thing you have already done"),
    counterpartWouldOwn: z
      .array(z.string())
      .min(1, "List at least one thing the Counterpart would own"),
    vestingTerms: z.string().trim().min(1, "State the vesting terms"),
    unitLabel: z.string().trim().min(1, "Name the unit, like merchant or seller"),
    revenuePerUnitPhpMonthly: z.coerce.number().min(0),
    variableCostPerUnitPhpMonthly: z.coerce.number().min(0),
    monthlyContributionPhp: z.coerce.number().positive("Set a monthly contribution target"),
    withinDays: z.coerce.number().int().positive(),
    internsWelcome: z.boolean(),
    milestones: z.array(milestoneInputSchema).min(1, "Add at least one milestone"),
  })
  .refine((v) => v.equityMaxPct <= 40, { message: "The platform cap is 40%", path: ["equityMaxPct"] })
  .refine((v) => v.equityMinPct <= v.equityMaxPct, {
    message: "Minimum cannot exceed maximum",
    path: ["equityMaxPct"],
  });

export const openingSchema = z.object({
  ventureId: z.string(),
  title: z.string().trim().min(2, "Give the role a title"),
  team: z.string().trim().min(1, "Name the team"),
  type: z.enum(OPENING_TYPES),
  arrangement: z.enum(WORK_ARRANGEMENTS),
  location: z.string().trim().min(1, "Where is this role based?"),
  summary: z.string().trim().min(20, "Say what the role does, in a sentence or two"),
  responsibilities: z.array(z.string()).min(1, "List at least one responsibility"),
  lookingFor: z.array(z.string()).min(1, "Say what you are looking for, in evidence"),
  compensationDetails: z.string().trim().min(80, "Explain the employer, pay dates, hours, benefits and working relationship in at least 80 characters"),
  salaryMinPhpMonthly: z.union([z.coerce.number().min(0), z.literal("").transform(() => null)]).nullable(),
  salaryMaxPhpMonthly: z.union([z.coerce.number().min(0), z.literal("").transform(() => null)]).nullable(),
  equityPct: z.union([z.coerce.number().min(0).max(5), z.literal("").transform(() => null)]).nullable(),
  fundedBy: z.enum(["ledger_revenue", "outside_funding"]),
});

export const jobApplicationSchema = z.object({
  evidence: z.string().trim().min(120, "Tell them what you have done, in at least 120 characters"),
  proofLinks: z.array(urlSchema).min(1, "Add at least one link that shows the work"),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Say when you can start"),
  expectedSalaryPhpMonthly: z.union([z.coerce.number().min(0), z.literal("").transform(() => null)]).nullable(),
  whyThisRole: z.string().trim().min(10, "Say why this role"),
});

export type FieldErrors = Record<string, string>;

/** Flatten a zod error into { "path.to.field": message }. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
