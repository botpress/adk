import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

// ============ browser_launch ============

const launchInputSchema = z.object({
  headless: z.boolean().optional().default(true).describe('Run browser in headless mode'),
  profile: z.string().optional().describe('Browser profile name to use (for persisting cookies/state)'),
  viewport: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe('Viewport size'),
  executablePath: z.string().optional().describe('Path to browser executable (uses system browser if not set)'),
  useNativeBrowser: z
    .boolean()
    .optional()
    .default(true)
    .describe('Use native system browser (Chrome/Brave/Edge) instead of Playwright bundled Chromium'),
})

const launchOutputSchema = z.object({
  sessionId: z.string().describe('Browser session ID for future operations'),
  browserKind: z.string().optional().describe('Type of browser launched (chrome, brave, edge, etc.)'),
  cdpPort: z.number().optional().describe('Chrome DevTools Protocol port'),
})

export const browserLaunchToolDef: ToolDefinition = {
  name: 'browser_launch',
  groups: ['browser', 'automation'],
  description: 'Launch a browser session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_launch',
      description:
        'Launch a new browser session. By default uses your installed Chrome/Brave/Edge browser. Returns a sessionId for subsequent operations.',
      input: launchInputSchema,
      output: launchOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/launch', input, ctx.config)
      },
    }),
}

// ============ browser_navigate ============

const navigateInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  url: z.string().describe('URL to navigate to'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('load')
    .describe('When to consider navigation complete'),
})

const navigateOutputSchema = z.object({
  success: z.boolean(),
  title: z.string().describe('Page title'),
  url: z.string().describe('Final URL after redirects'),
})

export const browserNavigateToolDef: ToolDefinition = {
  name: 'browser_navigate',
  groups: ['browser', 'automation'],
  description: 'Navigate to a URL',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_navigate',
      description: 'Navigate the browser to a URL.',
      input: navigateInputSchema,
      output: navigateOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/navigate', input, ctx.config)
      },
    }),
}

// ============ browser_snapshot ============

const snapshotInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  mode: z
    .enum(['full', 'interactive', 'efficient'])
    .optional()
    .default('interactive')
    .describe('Snapshot mode: interactive (buttons/links/inputs only), full (entire tree), efficient (interactive + content)'),
  maxDepth: z.number().optional().describe('Maximum depth to include in snapshot'),
})

const snapshotOutputSchema = z.object({
  snapshot: z.string().describe('Accessibility tree with element refs (e1, e2, etc.)'),
  refs: z.record(z.object({
    role: z.string(),
    name: z.string().optional(),
    nth: z.number().optional(),
  })).describe('Map of refs to element info'),
  stats: z.object({
    lines: z.number(),
    chars: z.number(),
    refs: z.number(),
    interactive: z.number(),
  }),
  url: z.string(),
  title: z.string(),
})

export const browserSnapshotToolDef: ToolDefinition = {
  name: 'browser_snapshot',
  groups: ['browser', 'automation'],
  description: 'Get an AI-friendly snapshot of page elements with refs',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_snapshot',
      description:
        'Get an accessibility tree snapshot of the page with element refs (e1, e2, etc.). Use these refs with browser_click, browser_type, etc. The "interactive" mode returns only clickable elements like buttons, links, inputs.',
      input: snapshotInputSchema,
      output: snapshotOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/snapshot', input, ctx.config)
      },
    }),
}

// ============ browser_click ============

const clickInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  ref: z.string().optional().describe('Element ref from snapshot (e.g., e1, e2) - preferred'),
  selector: z.string().optional().describe('CSS selector (deprecated, use ref instead)'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left'),
  clickCount: z.number().optional().default(1).describe('Number of clicks (2 for double-click)'),
})

const clickOutputSchema = z.object({
  success: z.boolean(),
})

export const browserClickToolDef: ToolDefinition = {
  name: 'browser_click',
  groups: ['browser', 'automation'],
  description: 'Click an element on the page',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_click',
      description:
        'Click an element on the page. Use the ref from browser_snapshot (e.g., e1, e2) for reliable element targeting. CSS selectors are supported but deprecated.',
      input: clickInputSchema,
      output: clickOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/click', input, ctx.config)
      },
    }),
}

// ============ browser_type ============

const typeInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  ref: z.string().optional().describe('Element ref from snapshot (e.g., e1, e2) - preferred'),
  selector: z.string().optional().describe('CSS selector (deprecated, use ref instead)'),
  text: z.string().describe('Text to type'),
  delay: z.number().optional().describe('Delay between keystrokes in ms'),
  clear: z.boolean().optional().default(false).describe('Clear existing content before typing'),
})

const typeOutputSchema = z.object({
  success: z.boolean(),
})

export const browserTypeToolDef: ToolDefinition = {
  name: 'browser_type',
  groups: ['browser', 'automation'],
  description: 'Type text into an input element',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_type',
      description:
        'Type text into an input element. Use the ref from browser_snapshot (e.g., e1, e2) for reliable element targeting.',
      input: typeInputSchema,
      output: typeOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/type', input, ctx.config)
      },
    }),
}

// ============ browser_hover ============

const hoverInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  ref: z.string().optional().describe('Element ref from snapshot (e.g., e1, e2)'),
  selector: z.string().optional().describe('CSS selector'),
})

const hoverOutputSchema = z.object({
  success: z.boolean(),
})

export const browserHoverToolDef: ToolDefinition = {
  name: 'browser_hover',
  groups: ['browser', 'automation'],
  description: 'Hover over an element',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_hover',
      description: 'Hover over an element on the page to trigger hover states or reveal dropdown menus.',
      input: hoverInputSchema,
      output: hoverOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/hover', input, ctx.config)
      },
    }),
}

// ============ browser_scroll ============

const scrollInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  ref: z.string().optional().describe('Element ref to scroll into view'),
  selector: z.string().optional().describe('CSS selector to scroll into view'),
  direction: z.enum(['up', 'down', 'left', 'right']).optional().describe('Scroll direction (if no element specified)'),
  amount: z.number().optional().describe('Amount to scroll in pixels (default 300)'),
})

const scrollOutputSchema = z.object({
  success: z.boolean(),
})

export const browserScrollToolDef: ToolDefinition = {
  name: 'browser_scroll',
  groups: ['browser', 'automation'],
  description: 'Scroll the page or an element into view',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_scroll',
      description:
        'Scroll an element into view (using ref or selector), or scroll the page in a direction (up/down/left/right).',
      input: scrollInputSchema,
      output: scrollOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/scroll', input, ctx.config)
      },
    }),
}

// ============ browser_press_key ============

const pressKeyInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  key: z.string().describe('Key to press (e.g., Enter, Tab, Escape, ArrowDown, Backspace)'),
  modifiers: z
    .array(z.enum(['Alt', 'Control', 'Meta', 'Shift']))
    .optional()
    .describe('Modifier keys to hold'),
})

const pressKeyOutputSchema = z.object({
  success: z.boolean(),
})

export const browserPressKeyToolDef: ToolDefinition = {
  name: 'browser_press_key',
  groups: ['browser', 'automation'],
  description: 'Press a keyboard key',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_press_key',
      description:
        'Press a keyboard key with optional modifiers. Use for navigation (Enter, Tab, Escape), form submission, or keyboard shortcuts (e.g., Control+A to select all).',
      input: pressKeyInputSchema,
      output: pressKeyOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/press-key', input, ctx.config)
      },
    }),
}

// ============ browser_select_option ============

const selectOptionInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  ref: z.string().optional().describe('Element ref for the select element'),
  selector: z.string().optional().describe('CSS selector for the select element'),
  value: z.string().optional().describe('Option value to select'),
  label: z.string().optional().describe('Option label/text to select'),
  index: z.number().optional().describe('Option index to select (0-based)'),
})

const selectOptionOutputSchema = z.object({
  success: z.boolean(),
  selected: z.array(z.string()).describe('Selected option values'),
})

export const browserSelectOptionToolDef: ToolDefinition = {
  name: 'browser_select_option',
  groups: ['browser', 'automation'],
  description: 'Select an option from a dropdown',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_select_option',
      description: 'Select an option from a dropdown/select element by value, label, or index.',
      input: selectOptionInputSchema,
      output: selectOptionOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/select-option', input, ctx.config)
      },
    }),
}

// ============ browser_screenshot ============

const screenshotInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  selector: z.string().optional().describe('CSS selector of element to screenshot (default: full page)'),
  fullPage: z.boolean().optional().default(false).describe('Capture full scrollable page'),
  format: z.enum(['png', 'jpeg']).optional().default('png'),
  quality: z.number().optional().describe('JPEG quality (0-100)'),
})

const screenshotOutputSchema = z.object({
  base64: z.string().describe('Base64-encoded screenshot image'),
  width: z.number().describe('Image width'),
  height: z.number().describe('Image height'),
})

export const browserScreenshotToolDef: ToolDefinition = {
  name: 'browser_screenshot',
  groups: ['browser', 'automation'],
  description: 'Capture a screenshot',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_screenshot',
      description: 'Capture a screenshot of the page or a specific element.',
      input: screenshotInputSchema,
      output: screenshotOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/screenshot', input, ctx.config)
      },
    }),
}

// ============ browser_extract ============

const extractInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  selector: z.string().describe('CSS selector for elements to extract'),
  attributes: z.array(z.string()).optional().describe('Attributes to extract (e.g., ["href", "src"])'),
  includeText: z.boolean().optional().default(true).describe('Include text content'),
  multiple: z.boolean().optional().default(false).describe('Extract all matching elements'),
})

const extractOutputSchema = z.object({
  elements: z.array(
    z.object({
      text: z.string().optional(),
      html: z.string().optional(),
      attributes: z.record(z.string()).optional(),
    })
  ),
  count: z.number(),
})

export const browserExtractToolDef: ToolDefinition = {
  name: 'browser_extract',
  groups: ['browser', 'automation'],
  description: 'Extract data from page elements',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_extract',
      description: 'Extract text and attributes from page elements using CSS selectors.',
      input: extractInputSchema,
      output: extractOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/extract', input, ctx.config)
      },
    }),
}

// ============ browser_execute ============

const executeInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  script: z.string().describe('JavaScript code to execute in page context'),
  args: z.array(z.unknown()).optional().describe('Arguments to pass to the script'),
})

const executeOutputSchema = z.object({
  result: z.unknown().describe('Return value from the script'),
})

export const browserExecuteToolDef: ToolDefinition = {
  name: 'browser_execute',
  groups: ['browser', 'automation'],
  description: 'Execute JavaScript in page context',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_execute',
      description: 'Execute JavaScript code in the browser page context.',
      input: executeInputSchema,
      output: executeOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/execute', input, ctx.config)
      },
    }),
}

// ============ browser_wait ============

const waitInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  selector: z.string().optional().describe('Wait for element matching selector'),
  timeout: z.number().optional().default(30000).describe('Timeout in ms'),
  state: z
    .enum(['attached', 'detached', 'visible', 'hidden'])
    .optional()
    .default('visible')
    .describe('Element state to wait for'),
})

const waitOutputSchema = z.object({
  success: z.boolean(),
  elapsed: z.number().describe('Time waited in ms'),
})

export const browserWaitToolDef: ToolDefinition = {
  name: 'browser_wait',
  groups: ['browser', 'automation'],
  description: 'Wait for an element or condition',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_wait',
      description: 'Wait for an element to appear, disappear, or reach a specific state.',
      input: waitInputSchema,
      output: waitOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/wait', input, ctx.config)
      },
    }),
}

// ============ browser_close ============

const closeInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
})

const closeOutputSchema = z.object({
  success: z.boolean(),
})

export const browserCloseToolDef: ToolDefinition = {
  name: 'browser_close',
  groups: ['browser', 'automation'],
  description: 'Close a browser session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_close',
      description: 'Close and clean up a browser session.',
      input: closeInputSchema,
      output: closeOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/close', input, ctx.config)
      },
    }),
}

// ============ browser_console ============

const consoleInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  clear: z.boolean().optional().default(false).describe('Clear messages after reading'),
})

const consoleOutputSchema = z.object({
  messages: z.array(
    z.object({
      type: z.string().describe('Message type (log, warning, error, etc.)'),
      text: z.string().describe('Message content'),
      timestamp: z.number().describe('Unix timestamp'),
    })
  ),
  count: z.number(),
})

export const browserConsoleToolDef: ToolDefinition = {
  name: 'browser_console',
  groups: ['browser', 'automation'],
  description: 'Get browser console messages',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_console',
      description: 'Get console messages (log, warn, error) collected from the page.',
      input: consoleInputSchema,
      output: consoleOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/console', input, ctx.config)
      },
    }),
}

// ============ browser_errors ============

const errorsInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  clear: z.boolean().optional().default(false).describe('Clear errors after reading'),
})

const errorsOutputSchema = z.object({
  errors: z.array(
    z.object({
      message: z.string().describe('Error message'),
      timestamp: z.number().describe('Unix timestamp'),
    })
  ),
  count: z.number(),
})

export const browserErrorsToolDef: ToolDefinition = {
  name: 'browser_errors',
  groups: ['browser', 'automation'],
  description: 'Get JavaScript errors from the page',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_errors',
      description: 'Get JavaScript errors that occurred on the page.',
      input: errorsInputSchema,
      output: errorsOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/errors', input, ctx.config)
      },
    }),
}

// ============ Phase 1: Core Interactions ============

// browser_drag
const dragInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  startRef: z.string().describe('Element ref (e1, e2) or selector to drag from'),
  endRef: z.string().describe('Element ref or selector to drag to'),
  timeout: z.number().optional().default(8000).describe('Timeout in ms'),
})

const dragOutputSchema = z.object({
  success: z.boolean(),
})

export const browserDragToolDef: ToolDefinition = {
  name: 'browser_drag',
  groups: ['browser', 'automation'],
  description: 'Drag an element and drop it on another element',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_drag',
      description: 'Drag an element and drop it on another element. Uses refs from browser_snapshot.',
      input: dragInputSchema,
      output: dragOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/drag', input, ctx.config)
      },
    }),
}

// browser_fill_form
const fillFormFieldSchema = z.object({
  ref: z.string().optional().describe('Element ref from snapshot'),
  selector: z.string().optional().describe('CSS selector'),
  value: z.string().describe('Value to fill'),
  type: z.enum(['text', 'checkbox', 'radio', 'select']).optional().default('text').describe('Field type'),
})

const fillFormInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  fields: z.array(fillFormFieldSchema).describe('Array of fields to fill'),
})

const fillFormOutputSchema = z.object({
  success: z.boolean(),
  filled: z.number().describe('Number of fields successfully filled'),
})

export const browserFillFormToolDef: ToolDefinition = {
  name: 'browser_fill_form',
  groups: ['browser', 'automation'],
  description: 'Fill multiple form fields at once',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_fill_form',
      description:
        'Fill multiple form fields in one call. Supports text inputs, checkboxes, radio buttons, and select dropdowns.',
      input: fillFormInputSchema,
      output: fillFormOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/fill-form', input, ctx.config)
      },
    }),
}

// browser_dialog
const dialogInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  action: z.enum(['accept', 'dismiss']).describe('Action to take on the dialog'),
  promptText: z.string().optional().describe('Text to enter for prompt dialogs'),
  timeout: z.number().optional().default(30000).describe('Timeout waiting for dialog'),
})

const dialogOutputSchema = z.object({
  type: z.string().describe('Dialog type (alert, confirm, prompt, beforeunload)'),
  message: z.string().describe('Dialog message'),
  handled: z.boolean(),
})

export const browserDialogToolDef: ToolDefinition = {
  name: 'browser_dialog',
  groups: ['browser', 'automation'],
  description: 'Handle JavaScript dialogs (alert, confirm, prompt)',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_dialog',
      description:
        'Wait for and handle JavaScript dialogs. Call this BEFORE triggering an action that shows a dialog.',
      input: dialogInputSchema,
      output: dialogOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/dialog', input, ctx.config)
      },
    }),
}

// ============ Phase 2: File Operations ============

// browser_upload
const uploadInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  ref: z.string().optional().describe('File input element ref'),
  selector: z.string().optional().describe('File input CSS selector'),
  paths: z.array(z.string()).describe('Absolute paths to files to upload'),
  timeout: z.number().optional().default(30000).describe('Timeout for file chooser'),
})

const uploadOutputSchema = z.object({
  success: z.boolean(),
  filesUploaded: z.number(),
})

export const browserUploadToolDef: ToolDefinition = {
  name: 'browser_upload',
  groups: ['browser', 'automation'],
  description: 'Upload files to a file input element',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_upload',
      description: 'Upload one or more files to a file input. Provide either ref/selector for direct input, or wait for file chooser dialog.',
      input: uploadInputSchema,
      output: uploadOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/upload', input, ctx.config)
      },
    }),
}

// browser_download
const downloadInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  clickRef: z.string().optional().describe('Element ref to click to trigger download'),
  clickSelector: z.string().optional().describe('CSS selector to click to trigger download'),
  savePath: z.string().optional().describe('Path to save the downloaded file'),
  timeout: z.number().optional().default(30000).describe('Timeout waiting for download'),
})

const downloadOutputSchema = z.object({
  url: z.string().describe('Download URL'),
  filename: z.string().describe('Suggested filename'),
  path: z.string().describe('Saved file path'),
})

export const browserDownloadToolDef: ToolDefinition = {
  name: 'browser_download',
  groups: ['browser', 'automation'],
  description: 'Download a file by clicking an element',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_download',
      description: 'Trigger a download by clicking an element and optionally save to a specific path.',
      input: downloadInputSchema,
      output: downloadOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/download', input, ctx.config)
      },
    }),
}

// browser_pdf
const pdfInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  path: z.string().optional().describe('Path to save the PDF file'),
  options: z
    .object({
      format: z.enum(['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']).optional(),
      landscape: z.boolean().optional(),
      printBackground: z.boolean().optional(),
      scale: z.number().optional(),
      margin: z
        .object({
          top: z.string().optional(),
          bottom: z.string().optional(),
          left: z.string().optional(),
          right: z.string().optional(),
        })
        .optional(),
    })
    .optional()
    .describe('PDF generation options'),
})

const pdfOutputSchema = z.object({
  path: z.string().describe('Saved file path'),
  size: z.number().describe('PDF size in bytes'),
  base64: z.string().optional().describe('Base64-encoded PDF if no path provided'),
})

export const browserPdfToolDef: ToolDefinition = {
  name: 'browser_pdf',
  groups: ['browser', 'automation'],
  description: 'Export the current page as a PDF',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_pdf',
      description: 'Generate a PDF of the current page. Requires headless mode.',
      input: pdfInputSchema,
      output: pdfOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/pdf', input, ctx.config)
      },
    }),
}

// ============ Phase 3: State & Storage ============

// browser_cookies_get
const cookiesGetInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  urls: z.array(z.string()).optional().describe('URLs to get cookies for (defaults to current page)'),
})

const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
})

const cookiesGetOutputSchema = z.object({
  cookies: z.array(cookieSchema),
})

export const browserCookiesGetToolDef: ToolDefinition = {
  name: 'browser_cookies_get',
  groups: ['browser', 'automation'],
  description: 'Get cookies from the browser',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_cookies_get',
      description: 'Get all cookies or cookies for specific URLs.',
      input: cookiesGetInputSchema,
      output: cookiesGetOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/cookies/get', input, ctx.config)
      },
    }),
}

// browser_cookies_set
const cookiesSetInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      url: z.string().optional(),
      domain: z.string().optional(),
      path: z.string().optional(),
      expires: z.number().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    })
  ),
})

const cookiesSetOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
})

export const browserCookiesSetToolDef: ToolDefinition = {
  name: 'browser_cookies_set',
  groups: ['browser', 'automation'],
  description: 'Set cookies in the browser',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_cookies_set',
      description: 'Add or update cookies in the browser context.',
      input: cookiesSetInputSchema,
      output: cookiesSetOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/cookies/set', input, ctx.config)
      },
    }),
}

// browser_cookies_clear
const cookiesClearInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
})

const cookiesClearOutputSchema = z.object({
  success: z.boolean(),
})

export const browserCookiesClearToolDef: ToolDefinition = {
  name: 'browser_cookies_clear',
  groups: ['browser', 'automation'],
  description: 'Clear all cookies',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_cookies_clear',
      description: 'Clear all cookies from the browser context.',
      input: cookiesClearInputSchema,
      output: cookiesClearOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/cookies/clear', input, ctx.config)
      },
    }),
}

// browser_storage_get
const storageGetInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  kind: z.enum(['local', 'session']).describe('Storage type'),
  key: z.string().optional().describe('Specific key to get (returns all if not specified)'),
})

const storageGetOutputSchema = z.object({
  values: z.record(z.string().nullable()),
})

export const browserStorageGetToolDef: ToolDefinition = {
  name: 'browser_storage_get',
  groups: ['browser', 'automation'],
  description: 'Get values from localStorage or sessionStorage',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_storage_get',
      description: 'Read values from localStorage or sessionStorage.',
      input: storageGetInputSchema,
      output: storageGetOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/storage/get', input, ctx.config)
      },
    }),
}

// browser_storage_set
const storageSetInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  kind: z.enum(['local', 'session']).describe('Storage type'),
  key: z.string(),
  value: z.string(),
})

const storageSetOutputSchema = z.object({
  success: z.boolean(),
})

export const browserStorageSetToolDef: ToolDefinition = {
  name: 'browser_storage_set',
  groups: ['browser', 'automation'],
  description: 'Set a value in localStorage or sessionStorage',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_storage_set',
      description: 'Write a value to localStorage or sessionStorage.',
      input: storageSetInputSchema,
      output: storageSetOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/storage/set', input, ctx.config)
      },
    }),
}

// browser_storage_clear
const storageClearInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  kind: z.enum(['local', 'session']).describe('Storage type'),
})

const storageClearOutputSchema = z.object({
  success: z.boolean(),
})

export const browserStorageClearToolDef: ToolDefinition = {
  name: 'browser_storage_clear',
  groups: ['browser', 'automation'],
  description: 'Clear localStorage or sessionStorage',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_storage_clear',
      description: 'Clear all data from localStorage or sessionStorage.',
      input: storageClearInputSchema,
      output: storageClearOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/storage/clear', input, ctx.config)
      },
    }),
}

// ============ Phase 4: Network & Debugging ============

// browser_network
const networkRequestSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  method: z.string(),
  url: z.string(),
  resourceType: z.string().optional(),
  status: z.number().optional(),
  ok: z.boolean().optional(),
  failureText: z.string().optional(),
})

const networkInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  filter: z
    .object({
      urlPattern: z.string().optional(),
      method: z.string().optional(),
      resourceType: z.string().optional(),
    })
    .optional()
    .describe('Filter captured requests'),
  clear: z.boolean().optional().default(false).describe('Clear request log after reading'),
  limit: z.number().optional().default(100).describe('Maximum requests to return'),
})

const networkOutputSchema = z.object({
  requests: z.array(networkRequestSchema),
  count: z.number(),
})

export const browserNetworkToolDef: ToolDefinition = {
  name: 'browser_network',
  groups: ['browser', 'automation'],
  description: 'Get captured network requests',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_network',
      description: 'Get network requests captured during the session. Filter by URL, method, or resource type.',
      input: networkInputSchema,
      output: networkOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/network', input, ctx.config)
      },
    }),
}

// browser_response
const responseInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  urlPattern: z.string().describe('URL pattern to match (substring or regex)'),
  timeout: z.number().optional().default(30000),
})

const responseOutputSchema = z.object({
  url: z.string(),
  status: z.number(),
  contentType: z.string(),
  body: z.unknown(),
})

export const browserResponseToolDef: ToolDefinition = {
  name: 'browser_response',
  groups: ['browser', 'automation'],
  description: 'Wait for and get a specific network response',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_response',
      description: 'Wait for a response matching a URL pattern and return its body.',
      input: responseInputSchema,
      output: responseOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/response', input, ctx.config)
      },
    }),
}

// browser_trace_start
const traceStartInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  screenshots: z.boolean().optional().default(true).describe('Capture screenshots during trace'),
  snapshots: z.boolean().optional().default(true).describe('Capture DOM snapshots during trace'),
})

const traceStartOutputSchema = z.object({
  success: z.boolean(),
})

export const browserTraceStartToolDef: ToolDefinition = {
  name: 'browser_trace_start',
  groups: ['browser', 'automation'],
  description: 'Start recording a Playwright trace',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_trace_start',
      description: 'Start recording a trace for debugging. Use browser_trace_stop to save it.',
      input: traceStartInputSchema,
      output: traceStartOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/trace/start', input, ctx.config)
      },
    }),
}

// browser_trace_stop
const traceStopInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  path: z.string().describe('Path to save the trace file (.zip)'),
})

const traceStopOutputSchema = z.object({
  path: z.string(),
})

export const browserTraceStopToolDef: ToolDefinition = {
  name: 'browser_trace_stop',
  groups: ['browser', 'automation'],
  description: 'Stop recording and save the trace',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_trace_stop',
      description: 'Stop the trace recording and save to a .zip file. Open with: npx playwright show-trace trace.zip',
      input: traceStopInputSchema,
      output: traceStopOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/trace/stop', input, ctx.config)
      },
    }),
}

// ============ Phase 5: Environment Emulation ============

// browser_emulate_device
const emulateDeviceInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  device: z.string().describe('Device name (e.g., "iPhone 12", "Pixel 5", "iPad Pro")'),
})

const emulateDeviceOutputSchema = z.object({
  success: z.boolean(),
  viewport: z.object({ width: z.number(), height: z.number() }),
  userAgent: z.string(),
  isMobile: z.boolean().optional(),
})

export const browserEmulateDeviceToolDef: ToolDefinition = {
  name: 'browser_emulate_device',
  groups: ['browser', 'automation'],
  description: 'Emulate a specific device',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_emulate_device',
      description: 'Emulate a mobile or tablet device with appropriate viewport, user agent, and touch support.',
      input: emulateDeviceInputSchema,
      output: emulateDeviceOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/emulate-device', input, ctx.config)
      },
    }),
}

// browser_geolocation
const geolocationInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  latitude: z.number().optional().describe('Latitude (-90 to 90)'),
  longitude: z.number().optional().describe('Longitude (-180 to 180)'),
  accuracy: z.number().optional().describe('Accuracy in meters'),
  clear: z.boolean().optional().default(false).describe('Clear geolocation override'),
})

const geolocationOutputSchema = z.object({
  success: z.boolean(),
  cleared: z.boolean().optional(),
})

export const browserGeolocationToolDef: ToolDefinition = {
  name: 'browser_geolocation',
  groups: ['browser', 'automation'],
  description: 'Set or clear geolocation override',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_geolocation',
      description: 'Override the browser geolocation. Useful for testing location-based features.',
      input: geolocationInputSchema,
      output: geolocationOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/geolocation', input, ctx.config)
      },
    }),
}

// browser_timezone
const timezoneInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  timezoneId: z.string().describe('IANA timezone ID (e.g., "America/New_York", "Europe/London")'),
})

const timezoneOutputSchema = z.object({
  success: z.boolean(),
})

export const browserTimezoneToolDef: ToolDefinition = {
  name: 'browser_timezone',
  groups: ['browser', 'automation'],
  description: 'Override the browser timezone',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_timezone',
      description: 'Set the browser timezone. Affects Date objects and Intl APIs.',
      input: timezoneInputSchema,
      output: timezoneOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/timezone', input, ctx.config)
      },
    }),
}

// browser_locale
const localeInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  locale: z.string().describe('Locale string (e.g., "en-US", "fr-FR", "ja-JP")'),
})

const localeOutputSchema = z.object({
  success: z.boolean(),
})

export const browserLocaleToolDef: ToolDefinition = {
  name: 'browser_locale',
  groups: ['browser', 'automation'],
  description: 'Override the browser locale',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_locale',
      description: 'Set the browser locale. Affects number/date formatting and navigator.language.',
      input: localeInputSchema,
      output: localeOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/locale', input, ctx.config)
      },
    }),
}

// browser_offline
const offlineInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  offline: z.boolean().describe('Enable or disable offline mode'),
})

const offlineOutputSchema = z.object({
  success: z.boolean(),
  offline: z.boolean(),
})

export const browserOfflineToolDef: ToolDefinition = {
  name: 'browser_offline',
  groups: ['browser', 'automation'],
  description: 'Enable or disable offline mode',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_offline',
      description: 'Simulate offline network conditions. All network requests will fail when enabled.',
      input: offlineInputSchema,
      output: offlineOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/offline', input, ctx.config)
      },
    }),
}

// browser_headers
const headersInputSchema = z.object({
  sessionId: z.string().describe('Browser session ID'),
  headers: z.record(z.string()).describe('Headers to add to all requests'),
})

const headersOutputSchema = z.object({
  success: z.boolean(),
})

export const browserHeadersToolDef: ToolDefinition = {
  name: 'browser_headers',
  groups: ['browser', 'automation'],
  description: 'Set extra HTTP headers for all requests',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'browser_headers',
      description: 'Add custom HTTP headers to all subsequent requests. Useful for auth tokens or API keys.',
      input: headersInputSchema,
      output: headersOutputSchema,
      handler: async (input) => {
        return await callLocalPlane('/browser/headers', input, ctx.config)
      },
    }),
}
