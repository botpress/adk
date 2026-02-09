import { Workflow } from "@botpress/runtime";
import { WebsiteKB } from "../knowledge/website-docs";

/**
 * Keeps the knowledge base up to date on a schedule.
 * KB sync happens at dev/deploy time, but the live website can change after that.
 * refresh() is a runtime operation that smart-refreshes only changed content
 * (uses SHA256 hashing), so it's cheap to run frequently.
 *
 * Admins can also trigger an immediate refresh via the admin-mode tool
 * if they need changes reflected sooner than the next 6-hour cycle.
 */
export const PeriodicIndexingWorkflow = new Workflow({
  name: "periodic_indexing",
  description: "A workflow that runs periodic indexing of the knowledge base",
  schedule: "0 */6 * * *",
  handler: () => WebsiteKB.refresh(),
});
