import { DataSource, Knowledge } from "@botpress/runtime";

const WebsiteSource = DataSource.Website.fromSitemap(
  "https://www.botpress.com/docs/sitemap.xml",
  {
    filter: ({ url }) => !url.includes("llms-full.txt"),
  }
);

export const WebsiteKB = new Knowledge({
  name: "Botpress",
  description: "Knowledge base containing Botpress documentation.",
  sources: [WebsiteSource],
});