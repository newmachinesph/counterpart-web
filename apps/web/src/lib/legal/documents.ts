import documents from "./documents.json";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  audience: string;
  summary: string;
  version: string;
  status: string;
  reviewPoints: string[];
  sections: LegalSection[];
  sources: { title: string; url: string }[];
}

export const LEGAL_DRAFT_DATE = "18 September 2026";
export const LEGAL_DRAFT_NOTICE = "Draft for review. Not in force and not available for acceptance. Complete the bracketed details and obtain advice for the actual parties and working relationship before adoption. These drafts do not amend any existing accepted agreement.";

export const legalDocuments: LegalDocument[] = documents;

export function getLegalDocument(slug: string) {
  return legalDocuments.find((document) => document.slug === slug);
}

export function legalDocumentMarkdown(document: LegalDocument): string {
  return [
    `# Counterpart: ${document.title}`,
    `Version: ${document.version}\nPrepared: ${LEGAL_DRAFT_DATE}\nStatus: DRAFT — NOT IN FORCE`,
    LEGAL_DRAFT_NOTICE,
    document.summary,
    "## Before adoption",
    document.reviewPoints.map((point) => `- ${point}`).join("\n"),
    ...document.sections.map((section, index) =>
      `## ${index + 1}. ${section.title}\n\n${section.paragraphs.join("\n\n")}`),
    "## Research references",
    "These references informed preparation; they do not certify this draft or replace advice on the actual arrangement.",
    document.sources.map((source) => `- [${source.title}](${source.url})`).join("\n"),
  ].join("\n\n") + "\n";
}
