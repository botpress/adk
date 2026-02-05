import { mkdir, writeFile, stat, readdir, copyFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SOUL_TEMPLATE = `# Soul

You are Omni, a capable AI assistant with access to the user's local machine through a secure local plane.

## Core Traits
- **Direct & Efficient**: Get to the point. Avoid unnecessary preamble.
- **Transparent**: Explain what you're about to do before taking actions that modify files or run commands.
- **Cautious with Destructive Actions**: Always confirm before deleting files, overwriting data, or running commands with side effects.
- **Privacy-Conscious**: Only access files and data when relevant to the task at hand.

## Working Style
- Prefer simple, maintainable solutions over clever ones
- Read existing code/files before making changes
- Keep changes minimal and focused
- Ask clarifying questions when requirements are ambiguous

## Communication
- Be concise in responses
- Use code blocks for commands and file contents
- Summarize results after completing tasks
- Acknowledge errors honestly and suggest fixes

## Custom Instructions
<!-- Add your personal preferences below -->
`

/**
 * Seeds the workspace with default files if they don't exist.
 * Creates the directory structure and SOUL.md template.
 *
 * @param workspacePath - The path to the workspace directory
 * @returns Array of created file/directory paths (empty if nothing was created)
 */
export async function seedWorkspace(workspacePath: string): Promise<string[]> {
  const created: string[] = []

  // Create .omni/memory directory
  const memoryDir = join(workspacePath, '.omni', 'memory')
  await mkdir(memoryDir, { recursive: true })

  // Write SOUL.md if it doesn't exist
  const soulPath = join(workspacePath, 'SOUL.md')
  try {
    await stat(soulPath)
    // File exists, don't overwrite
  } catch {
    await writeFile(soulPath, SOUL_TEMPLATE, 'utf8')
    created.push('SOUL.md')
  }

  // Seed skills from bundled skills
  const skillsCreated = await seedSkills(workspacePath)
  created.push(...skillsCreated)

  return created
}

/**
 * Get the bundled skills directory path
 */
function getBundledSkillsDir(): string {
  // Navigate from src/ to skills/
  return join(__dirname, '..', 'skills')
}

/**
 * Copy a directory recursively
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await copyFile(srcPath, destPath)
    }
  }
}

/**
 * Seed skills from bundled skills to workspace
 * Only copies if the skill directory doesn't exist (preserves user customizations)
 */
async function seedSkills(workspacePath: string): Promise<string[]> {
  const created: string[] = []
  const bundledDir = getBundledSkillsDir()
  const targetDir = join(workspacePath, 'skills')

  // Ensure skills directory exists
  await mkdir(targetDir, { recursive: true })

  try {
    const entries = await readdir(bundledDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const srcSkillDir = join(bundledDir, entry.name)
      const destSkillDir = join(targetDir, entry.name)

      // Only copy if destination doesn't exist
      try {
        await stat(destSkillDir)
        // Skill exists, skip
      } catch {
        // Skill doesn't exist, copy it
        await copyDir(srcSkillDir, destSkillDir)
        created.push(`skills/${entry.name}`)
      }
    }
  } catch {
    // Bundled skills directory doesn't exist or can't be read
  }

  return created
}
