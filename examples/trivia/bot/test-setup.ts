import { beforeAll } from "bun:test";
import { setupTestRuntime } from "@botpress/adk";

beforeAll(async () => {
  const result = await setupTestRuntime();
  await result.initialize();
});
