/** Export the reviewed text corpus without reading configuration or credentials. */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const documents = JSON.parse(await readFile(new URL("apps/web/src/lib/legal/documents.json", root), "utf8"));
const output = new URL("docs/legal/COUNTERPART-LEGAL-PACK.md", root);
const parts = [
  "# Counterpart agreement and policy review pack",
  "Prepared 18 September 2026. **DRAFT — NOT IN FORCE.**",
  "These proposed documents are not available for acceptance and do not amend existing agreements. Complete bracketed details, confirm the operator and obtain legal advice for the actual arrangements before adoption. Payments and signing of cofounder instruments remain external.",
  "Source: `apps/web/src/lib/legal/documents.json`. Regenerate with `node scripts/export-legal-pack.mjs`. The same text is available at `/legal` and through individual Markdown downloads.",
];
for (const document of documents) {
  if (document.status !== "draft") throw new Error("This exporter is only for draft documents");
  parts.push(`---\n\n# ${document.title}`, `Version: ${document.version}\n\nAudience: ${document.audience}\n\nStatus: DRAFT — NOT IN FORCE`, document.summary,
    "## Before adoption", document.reviewPoints.map((point) => `- ${point}`).join("\n"));
  document.sections.forEach((section, index) => parts.push(`## ${index + 1}. ${section.title}`, ...section.paragraphs));
  parts.push("## Research references", "These references informed preparation; they do not certify this draft or replace advice on the actual arrangement.",
    document.sources.map((source) => `- [${source.title}](${source.url})`).join("\n"));
}
await mkdir(new URL("docs/legal/", root), { recursive: true });
await writeFile(output, parts.join("\n\n") + "\n", "utf8");
console.log(`Exported ${documents.length} draft documents to docs/legal/COUNTERPART-LEGAL-PACK.md`);
