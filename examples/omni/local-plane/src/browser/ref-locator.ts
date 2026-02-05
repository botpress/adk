import type { Page, Locator } from 'playwright-core'
import { parseRoleRef, type RoleRefMap } from './role-snapshot.js'

/**
 * Resolve a ref (e1, e2, @e1, ref=e1) or CSS selector to a Playwright Locator.
 *
 * If the input is a ref and roleRefs is provided, uses getByRole() for reliable element selection.
 * Otherwise falls back to CSS selector.
 */
export function resolveLocator(page: Page, refOrSelector: string, roleRefs?: RoleRefMap): Locator {
  // Check if it's a ref (e1, e2, @e1, ref=e1)
  const parsed = parseRoleRef(refOrSelector)

  if (parsed && roleRefs?.[parsed]) {
    const { role, name, nth } = roleRefs[parsed]

    // Build the locator using getByRole
    let locator = page.getByRole(role as any, {
      name: name,
      exact: false,
    })

    // If there are multiple elements with the same role+name, use nth
    if (nth !== undefined && nth > 0) {
      locator = locator.nth(nth)
    }

    return locator
  }

  // Fall back to CSS selector
  return page.locator(refOrSelector)
}

/**
 * Check if a string looks like a role ref (e1, e2, @e1, ref=e1).
 */
export function isRoleRef(value: string): boolean {
  return parseRoleRef(value) !== null
}

/**
 * Get the normalized ref string from various formats.
 * Returns null if not a valid ref.
 */
export function normalizeRef(value: string): string | null {
  return parseRoleRef(value)
}
