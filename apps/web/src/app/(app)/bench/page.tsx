import { Button, Empty, INPUT_CLASS, LinkButton, PageHeader } from "@/components/ui";
import { VentureCard } from "@/components/venture-card";
import { VENTURE_CATEGORIES, VENTURE_STAGES, type VentureCategory, type VentureStage, } from "@/lib/domain/types";
import { CATEGORY_LABELS, STAGE_LABELS } from "@/lib/format";
import { listBench, type BenchFilters } from "@/lib/services/ventures";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bench" };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

function num(v: string | string[] | undefined): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseFilters(params: Params): BenchFilters {
  const category = str(params.category);
  const stage = str(params.stage);
  return {
    category: (VENTURE_CATEGORIES as readonly string[]).includes(category)
      ? (category as VentureCategory)
      : null,
    stage: (VENTURE_STAGES as readonly string[]).includes(stage) ? (stage as VentureStage) : null,
    hoursMax: num(params.hoursMax),
  };
}

export default async function BenchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const cards = (await listBench(filters));
  const anyFilter = Object.values(filters).some((v) => v != null);

  return (
    <div>
      <PageHeader
        title="Bench"
        description="Explore products and projects in development looking for a commercial counterpart. Both accept applications; paid terms must be agreed before work starts."
      />

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Category</span>
          <select name="category" defaultValue={filters.category ?? ""} className={INPUT_CLASS}>
            <option value="">Any</option>
            {VENTURE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Stage</span>
          <select name="stage" defaultValue={filters.stage ?? ""} className={INPUT_CLASS}>
            <option value="">Any</option>
            {VENTURE_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Hours per week, up to</span>
          <input
            type="number"
            name="hoursMax"
            min={1}
            max={80}
            defaultValue={filters.hoursMax ?? ""}
            className={INPUT_CLASS}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1">
            Filter
          </Button>
          {anyFilter ? (
            <LinkButton href="/bench" variant="secondary">
              Clear
            </LinkButton>
          ) : null}
        </div>
      </form>

      {cards.length === 0 ? (
        <Empty>
          {anyFilter
            ? "No ventures match these filters."
            : "Nothing on the Bench right now. Ventures return here when a pairing ends."}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <VentureCard key={card.venture.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
