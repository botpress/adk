/**
 * Shared prompt templates for the omni agent system
 */

/**
 * Standard task completion format
 */
export const TASK_COMPLETE_FORMAT = `
When you have completed the task:
1. Summarize what was accomplished
2. Note any relevant outputs or results
3. Mention any follow-up actions needed
`

/**
 * Standard error handling format
 */
export const ERROR_HANDLING_FORMAT = `
When you encounter an error:
1. Explain what went wrong clearly
2. Describe what you tried
3. Suggest potential solutions or next steps
`

/**
 * Standard context loading preamble
 */
export const CONTEXT_LOADING_PREAMBLE = `
At the start of a session, load context files to understand:
- Your personality and behavioral guidelines (SOUL.md)
- Multi-agent coordination rules (AGENTS.md)
- Previous conversation state (memory)
`

/**
 * Build a delegation task prompt
 */
export function buildDelegationPrompt(agentName: string, task: string, context?: string): string {
  let prompt = `## Delegated Task for ${agentName}\n\n**Task:** ${task}\n`

  if (context) {
    prompt += `\n**Context:** ${context}\n`
  }

  prompt += `
**Instructions:**
- Focus on completing the specific task above
- Report results clearly when done
- If you encounter blockers, explain the issue
`

  return prompt
}

/**
 * Build a system prompt header with timestamp
 */
export function buildSystemHeader(agentId: string, sessionKey?: string): string {
  const now = new Date().toISOString()
  let header = `Session started: ${now}\nAgent: ${agentId}`

  if (sessionKey) {
    header += `\nSession: ${sessionKey}`
  }

  return header
}

/**
 * Format tool output for inclusion in prompts
 */
export function formatToolOutput(toolName: string, output: unknown): string {
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
  return `<tool_result name="${toolName}">\n${outputStr}\n</tool_result>`
}

/**
 * Build a file context summary
 */
export function buildFileContextSummary(files: Record<string, string>): string {
  const entries = Object.entries(files)
  if (entries.length === 0) {
    return 'No context files loaded.'
  }

  const summary = entries
    .map(([path, content]) => {
      const lines = content.split('\n').length
      return `- ${path} (${lines} lines)`
    })
    .join('\n')

  return `Loaded context files:\n${summary}`
}

/**
 * Standard code review guidelines
 */
export const CODE_REVIEW_GUIDELINES = `
When reviewing code:
1. Check for correctness and logic errors
2. Verify error handling and edge cases
3. Look for security issues
4. Assess readability and maintainability
5. Suggest improvements with clear rationale
`

/**
 * Standard coding best practices
 */
export const CODING_BEST_PRACTICES = `
When writing code:
1. Follow existing patterns and conventions
2. Keep functions focused and small
3. Add comments for non-obvious logic
4. Handle errors appropriately
5. Write testable code
`

/**
 * Build the skills section for system prompt injection
 *
 * Wraps the compact XML skill list with mandatory on-demand read instructions.
 * Agent reads full SKILL.md via file_read when a skill matches the task.
 *
 * @param skillsPrompt - The compact XML skill listing from formatSkillsForPrompt()
 * @param readToolName - The name of the file read tool (default: 'file_read')
 */
export function buildSkillsSection(skillsPrompt: string, readToolName = 'file_read'): string {
  const trimmed = skillsPrompt?.trim()
  if (!trimmed) {
    return ''
  }

  return `## Skills (mandatory)
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${readToolName}\`, then follow it.
- If multiple could apply: choose the most specific one, then read/follow it.
- If none clearly apply: do not read any SKILL.md.
Constraints: never read more than one skill up front; only read after selecting.

${trimmed}
`
}
