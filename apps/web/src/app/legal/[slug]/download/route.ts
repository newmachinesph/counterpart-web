import { getLegalDocument, legalDocumentMarkdown } from "@/lib/legal/documents";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const document = getLegalDocument((await params).slug);
  if (!document) return new Response("Document not found", { status: 404 });
  return new Response(legalDocumentMarkdown(document), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${document.version}.md"`,
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
