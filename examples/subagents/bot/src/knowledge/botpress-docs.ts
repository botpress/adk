import { DataSource, Knowledge } from "@botpress/runtime";

/**
 * Crawls Botpress documentation from the sitemap.
 * Content is synced at dev/deploy time and can be refreshed at runtime
 * via KB.refresh(). The filter excludes the bulk LLM export
 * file which is too large for useful chunking.
 */
const WebsiteSource = DataSource.Website.fromSitemap(
  "https://www.botpress.com/docs/sitemap.xml",
  {
    filter: ({ url }) => !url.includes("llms-full.txt"),
  }
);

/**
 * When passed to execute() via the knowledge array, the AI gets an
 * auto-generated search_knowledge tool that queries this KB. The docs
 * agent uses this as its only data source — no custom tools needed.
 */
export const WebsiteKB = new Knowledge({
  name: "Botpress",
  description: "Knowledge base containing Botpress documentation.",
  sources: [WebsiteSource],
});