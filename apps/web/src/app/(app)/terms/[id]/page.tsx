
import { AgreementEditor } from "@/components/agreement-editor";
import { getStore } from "@/lib/data/store";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = { title: "Agreement template" };

export default async function TermsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "terms_v0") redirect("/terms/operator_v1");
  const terms = (await getStore()).termsTemplates.find((t) => t.id === id);
  if (!terms) notFound();
  return <AgreementEditor terms={terms} />;
}
