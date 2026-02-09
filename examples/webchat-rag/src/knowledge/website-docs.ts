import { DataSource, Knowledge } from "@botpress/runtime";

/**
 * Crawls Botpress documentation pages from the sitemap.
 * Using fromSitemap() automatically discovers all indexed pages,
 * so the KB stays comprehensive as new docs are added to the site.
 * The filter excludes the bulk LLM export file which is a single massive
 * page not useful for chunked retrieval.
 */
const WebsiteSource = DataSource.Website.fromSitemap(
  "https://www.botpress.com/docs/sitemap.xml",
  {
    filter: ({ url }) => !url.includes("llms-full.txt"),
  }
);

/**
 * The primary knowledge base for this agent.
 * Passed to execute() in the conversation handler to enable RAG —
 * the autonomous agent automatically gets a search_knowledge tool
 * that queries this KB and returns relevant chunks.
 *
 * Refreshed on two paths:
 * - Automatically every 6 hours via the website-indexing workflow
 * - Manually by admins via the refreshKnowledgeBases tool in admin-mode
 */
export const WebsiteKB = new Knowledge({
  name: "Botpress",
  description: "Knowledge base containing Botpress documentation.",
  sources: [WebsiteSource],
});
