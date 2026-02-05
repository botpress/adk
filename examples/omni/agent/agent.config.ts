import { z, defineConfig } from '@botpress/runtime'

export default defineConfig({
  name: 'omni',
  description: 'Multi-agent system with local execution capabilities',

  dependencies: {
    integrations: {
      chat: { version: 'chat@0.7.3', enabled: true },
    },
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  configuration: {
    schema: z.object({
      localPlaneUrl: z.string().optional().describe('URL of the local control plane'),
      localPlaneToken: z.string().secret().optional().describe('Bearer token for local plane'),
      workspacePath: z.string().optional().describe('Default workspace path'),
      soulMdPath: z.string().optional().describe('Path to SOUL.md file'),
      agentsMdPath: z.string().optional().describe('Path to AGENTS.md file'),
    }),
  },
})
