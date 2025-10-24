import { Workflow } from "@botpress/runtime";
import { WebsiteKB } from "../knowledge/website-docs";

export const PeriodicIndexingWorkflow = new Workflow({
  name: "periodic_indexing",
  description: "A workflow that runs periodic indexing of the knowledge base",
  schedule: "0 */6 * * *", // Every 6 hours
  handler: () => WebsiteKB.refresh(),
});
