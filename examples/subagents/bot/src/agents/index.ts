/**
 * @agents Subagent Registry
 *
 * All 5 specialist subagents are exported from this barrel file. The orchestrator
 * conversation imports them all and converts each to an Autonomous.Tool via .asTool().
 *
 * ADDING A NEW SUBAGENT:
 * 1. Create a new file in this directory (e.g., marketing.ts)
 * 2. Define domain tools + SubAgent config following the same pattern as hr.ts
 * 3. Export the SubAgent instance here
 * 4. Add it to the orchestrator's tools array in conversations/index.ts
 * The orchestrator LLM will automatically learn to route requests to the new specialist
 * based on its description — no routing code changes needed.
 */
export { hrAgent } from "./hr";
export { itAgent } from "./it";
export { salesAgent } from "./sales";
export { financeAgent } from "./finance";
export { docsAgent } from "./docs";
