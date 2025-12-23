export const BOT_CONFIG = {
  clientId: import.meta.env.VITE_BOT_CLIENT_ID || "",
  name: "Clause Extraction Bot",
  description: "Extract and analyze clauses from legal contracts",
};

/**
 * Timing constants for UI interactions
 */
export const TIMING = {
  /** Delay before focusing input after state changes */
  FOCUS_DELAY_MS: 100,
  /** Animation duration for panel open/close */
  PANEL_ANIMATION_MS: 300,
  /** How long to show clipboard success feedback */
  CLIPBOARD_SUCCESS_MS: 2000,
} as const;

/**
 * Polling configuration
 */
export const POLLING = {
  /** Interval for extraction progress polling */
  INTERVAL_MS: 1000,
  /** Maximum recent activities to display */
  MAX_RECENT_ACTIVITIES: 5,
} as const;

export const CLIENT_ID = BOT_CONFIG.clientId;

export const CLAUSE_TYPE_LABELS: Record<string, string> = {
  payment_terms: "Payment Terms",
  liability_limitation: "Liability",
  indemnification: "Indemnification",
  termination: "Termination",
  confidentiality: "Confidentiality",
  force_majeure: "Force Majeure",
  warranties: "Warranties",
  governing_law: "Governing Law",
  dispute_resolution: "Dispute Resolution",
  intellectual_property: "IP Rights",
  assignment: "Assignment",
  amendment: "Amendment",
  other: "Other",
};

export const RISK_COLORS = {
  low: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800",
  },
  medium: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800",
  },
  high: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
  },
};
