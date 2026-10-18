import { describe, expect, it } from "vitest";
import type { Store } from "@/lib/data/store";
import type { Venture } from "@/lib/domain/types";
import { createReadModel } from "./read-model";

function model(status: Venture["status"], live = false) {
  const venture: Venture = {
    id: "ven_development", status, stage: "development", category: "saas",
    createdAt: "2026-09-18T00:00:00Z", slug: "development", name: "Development project",
    oneLiner: "A project accepting early applications", description: "A project still in development.",
    builderId: "usr_builder", productUrl: "https://example.com", productUrlVerifiedAt: null,
    screenshots: [], tractionSummary: "", equityMinPct: 0, equityMaxPct: 0, hoursPerWeek: 0,
    builderHasDone: [], counterpartWouldOwn: [], metrics: [], pricing: [],
    unitEconomics: { unitLabel: "customer", revenuePerUnitPhpMonthly: 0, variableCostPerUnitPhpMonthly: 0, note: "" },
    profitabilityTarget: { monthlyContributionPhp: 0, withinDays: 90, excludes: [] },
    internsWelcome: false, vestingTerms: "", termsTemplateId: "operator_v1",
  };
  const store: Store = {
    ventures: [venture], liveVentureIds: live ? [venture.id] : [], applicantCounts: {},
    jobApplicantCounts: {}, ledgerRevenue: {}, users: [], milestones: [], pairings: [],
    ledgerEntries: [], vesting: [], voided: [], applications: [], openings: [],
    jobApplications: [], termsTemplates: [], notifications: [], outbox: [],
  };
  return { venture, read: createReadModel(store) };
}

describe("development venture applications", () => {
  it("lists a development venture with pending terms and permits applications", () => {
    const { venture, read } = model("development");
    expect(read.isOnBench(venture)).toBe(true);
    expect(read.listBench({ stage: "development" }).map(card => card.venture.id)).toEqual([venture.id]);
  });

  it.each(["published", "development"] as const)("closes applications and hides %s ventures with a live pairing", status => {
    const { venture, read } = model(status, true);
    expect(read.isOnBench(venture)).toBe(false);
    expect(read.listBench()).toEqual([]);
  });

  it("keeps drafts closed and out of the public Bench", () => {
    const { venture, read } = model("draft");
    expect(read.isOnBench(venture)).toBe(false);
    expect(read.listBench()).toEqual([]);
  });
});
