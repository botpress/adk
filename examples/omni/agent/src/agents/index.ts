/**
 * Agent system exports
 */

// Types
export type { AgentDefinition, AgentContext, DelegateResult, ToolPolicy } from './types.js'

// Registry
export {
  registerAgent,
  getAgent,
  getAllAgents,
  listAgentIds,
  listAgentsForToolDescription,
  hasAgentRegistered,
  unregisterAgent,
  clearAgentRegistry,
  resolveAgentInstructions,
  getAgentsByTag,
  getRegistrySummary,
} from './registry.js'

// Agent definitions
export { mainAgent } from './definitions/main.js'
export { coderAgent } from './definitions/coder.js'
export { researchAgent } from './definitions/research.js'
export { homeAgent } from './definitions/home.js'
export { browserAgent } from './definitions/browser.js'
export { extractorAgent } from './definitions/extractor.js'
export { appEngineerAgent } from './definitions/app-engineer.js'
