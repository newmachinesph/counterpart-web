import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { VentureForm } from "./venture-form";

export const metadata: Metadata = { title: "List a venture" };

export default async function NewVenturePage() {
  await requireRole("builder", "/ventures/new");
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="List a venture"
        description="It saves as a draft. Publishing checks that the product URL answers and that there is at least one screenshot."
      />
      <VentureForm />
    </div>
  );
}