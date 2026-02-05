/**
 * Send-keys parser with tmux-style encoding
 *
 * Converts human-readable key sequences to terminal escape codes.
 *
 * Supported formats:
 * - Literal text: typed as-is
 * - C-x: Ctrl+X (e.g., C-c, C-d, C-z)
 * - M-x: Alt/Meta+X (e.g., M-f, M-b)
 * - Enter, Tab, Escape, Space, Backspace
 * - Up, Down, Left, Right (arrow keys)
 * - Home, End, PageUp, PageDown
 * - F1-F12 (function keys)
 */

/**
 * Special key mappings to terminal escape sequences
 */
const SPECIAL_KEYS: Record<string, string> = {
  // Basic keys
  Enter: '\r',
  Return: '\r',
  Tab: '\t',
  Escape: '\x1b',
  Esc: '\x1b',
  Space: ' ',
  Backspace: '\x7f',
  Delete: '\x1b[3~',

  // Arrow keys
  Up: '\x1b[A',
  Down: '\x1b[B',
  Right: '\x1b[C',
  Left: '\x1b[D',

  // Navigation
  Home: '\x1b[H',
  End: '\x1b[F',
  PageUp: '\x1b[5~',
  PageDown: '\x1b[6~',
  Insert: '\x1b[2~',

  // Function keys (xterm)
  F1: '\x1bOP',
  F2: '\x1bOQ',
  F3: '\x1bOR',
  F4: '\x1bOS',
  F5: '\x1b[15~',
  F6: '\x1b[17~',
  F7: '\x1b[18~',
  F8: '\x1b[19~',
  F9: '\x1b[20~',
  F10: '\x1b[21~',
  F11: '\x1b[23~',
  F12: '\x1b[24~',
}

/**
 * Parse a Ctrl+key sequence (C-x) to its terminal escape code
 */
function parseCtrlKey(char: string): string {
  const lower = char.toLowerCase()
  // Ctrl+A is 0x01, Ctrl+Z is 0x1A
  if (lower >= 'a' && lower <= 'z') {
    return String.fromCharCode(lower.charCodeAt(0) - 96)
  }
  // Special Ctrl combinations
  const ctrlSpecial: Record<string, string> = {
    '@': '\x00',
    '[': '\x1b',
    '\\': '\x1c',
    ']': '\x1d',
    '^': '\x1e',
    '_': '\x1f',
    '?': '\x7f',
  }
  return ctrlSpecial[char] ?? char
}

/**
 * Parse an Alt/Meta+key sequence (M-x) to its terminal escape code
 */
function parseMetaKey(char: string): string {
  // Meta key is typically ESC followed by the character
  return '\x1b' + char
}

/**
 * Token types in send-keys input
 */
type Token =
  | { type: 'literal'; value: string }
  | { type: 'ctrl'; char: string }
  | { type: 'meta'; char: string }
  | { type: 'shift'; key: string }
  | { type: 'special'; key: string }

/**
 * Tokenize a send-keys string into parseable tokens
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    // Check for C-x (Ctrl)
    if (input.substring(i, i + 2) === 'C-' && i + 2 < input.length) {
      tokens.push({ type: 'ctrl', char: input[i + 2]! })
      i += 3
      continue
    }

    // Check for M-x (Meta/Alt)
    if (input.substring(i, i + 2) === 'M-' && i + 2 < input.length) {
      tokens.push({ type: 'meta', char: input[i + 2]! })
      i += 3
      continue
    }

    // Check for S-x (Shift) - mainly for special keys like S-Tab
    if (input.substring(i, i + 2) === 'S-') {
      // Find the end of the key name
      let end = i + 2
      while (end < input.length && /[a-zA-Z0-9]/.test(input[end]!)) {
        end++
      }
      const key = input.substring(i + 2, end)
      tokens.push({ type: 'shift', key })
      i = end
      continue
    }

    // Check for special keys (must be at word boundary)
    let foundSpecial = false
    for (const key of Object.keys(SPECIAL_KEYS)) {
      if (input.substring(i, i + key.length) === key) {
        // Check if it's a word boundary (next char is not alphanumeric)
        const nextChar = input[i + key.length]
        if (nextChar === undefined || !/[a-zA-Z0-9]/.test(nextChar)) {
          tokens.push({ type: 'special', key })
          i += key.length
          foundSpecial = true
          break
        }
      }
    }
    if (foundSpecial) continue

    // Treat as literal character
    tokens.push({ type: 'literal', value: input[i]! })
    i++
  }

  return tokens
}

/**
 * Convert tokens to terminal escape sequences
 */
function tokensToSequence(tokens: Token[]): string {
  let result = ''

  for (const token of tokens) {
    switch (token.type) {
      case 'literal':
        result += token.value
        break

      case 'ctrl':
        result += parseCtrlKey(token.char)
        break

      case 'meta':
        result += parseMetaKey(token.char)
        break

      case 'shift':
        // Handle shift+key combinations
        if (token.key === 'Tab') {
          result += '\x1b[Z' // Shift+Tab (backtab)
        } else {
          // For other shift combinations, just send uppercase or special
          result += token.key.toUpperCase()
        }
        break

      case 'special':
        result += SPECIAL_KEYS[token.key] ?? ''
        break
    }
  }

  return result
}

/**
 * Parse a send-keys string to terminal escape sequences
 *
 * @example
 * parseSendKeys('ls -la')        // Returns 'ls -la'
 * parseSendKeys('C-c')           // Returns '\x03' (Ctrl+C)
 * parseSendKeys('vim file.txt Enter :wq Enter')
 *   // Returns 'vim file.txt\r:wq\r'
 * parseSendKeys('echo hello C-c') // Returns 'echo hello\x03'
 */
export function parseSendKeys(input: string): string {
  const tokens = tokenize(input)
  return tokensToSequence(tokens)
}

/**
 * Validate a send-keys string without converting
 * Returns an error message if invalid, or null if valid
 */
export function validateSendKeys(input: string): string | null {
  try {
    parseSendKeys(input)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid send-keys string'
  }
}

/**
 * Get a human-readable description of what a send-keys string will do
 */
export function describeSendKeys(input: string): string {
  const tokens = tokenize(input)
  const descriptions: string[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'literal':
        // Group consecutive literals
        if (descriptions.length > 0 && descriptions[descriptions.length - 1]!.startsWith('Type: ')) {
          descriptions[descriptions.length - 1] += token.value
        } else {
          descriptions.push(`Type: ${token.value}`)
        }
        break
      case 'ctrl':
        descriptions.push(`Ctrl+${token.char.toUpperCase()}`)
        break
      case 'meta':
        descriptions.push(`Alt+${token.char}`)
        break
      case 'shift':
        descriptions.push(`Shift+${token.key}`)
        break
      case 'special':
        descriptions.push(token.key)
        break
    }
  }

  return descriptions.join(', ')
}
