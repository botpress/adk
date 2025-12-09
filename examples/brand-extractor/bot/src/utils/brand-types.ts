import { z } from "@botpress/runtime";

// Step status for workflow progress tracking
export const StepStatus = z.enum(["pending", "in_progress", "done", "error"]);
export type StepStatus = z.infer<typeof StepStatus>;

// Overall extraction status
export const ExtractionStatus = z.enum([
  "in_progress",
  "done",
  "errored",
  "cancelled",
]);
export type ExtractionStatus = z.infer<typeof ExtractionStatus>;

// Individual step state
export const StepState = z.object({
  status: StepStatus,
  error: z.string().optional(),
});
export type StepState = z.infer<typeof StepState>;

// Color theme structure (simplified, matching stratus pattern)
export const ColorTheme = z.object({
  primary: z.string().describe("Primary brand color (hex)"),
  secondary: z.string().describe("Secondary brand color (hex)"),
  accent: z.string().describe("Accent/highlight color (hex)"),
  background: z.string().describe("Background color (hex)"),
  text: z.string().describe("Text color (hex)"),
});
export type ColorTheme = z.infer<typeof ColorTheme>;

// Complete brand data
export const BrandData = z.object({
  companyName: z.string(),
  websiteUrl: z.string(),
  logoUrl: z.string().optional(),
  screenshotUrl: z.string().optional(),
  lightTheme: ColorTheme.optional(),
  darkTheme: ColorTheme.optional(),
  defaultTheme: z.enum(["light", "dark"]).optional(),
  borderRadius: z.number().optional().describe("Border radius in rem units (0.5-4)"),
});
export type BrandData = z.infer<typeof BrandData>;

// Steps tracking for UI
export const ExtractionSteps = z.object({
  websiteSearch: StepState.extend({
    url: z.string().optional(),
  }),
  screenshot: StepState.extend({
    imageUrl: z.string().optional(),
  }),
  logoExtraction: StepState.extend({
    logoUrl: z.string().optional(),
  }),
  colorExtraction: StepState,
});
export type ExtractionSteps = z.infer<typeof ExtractionSteps>;

// Full progress data sent to frontend
export const BrandProgressData = z.object({
  status: ExtractionStatus,
  companyName: z.string(),
  websiteUrl: z.string().optional(),
  steps: ExtractionSteps,
  brandData: BrandData.optional(),
  error: z.string().optional(),
});
export type BrandProgressData = z.infer<typeof BrandProgressData>;

// Helper to create initial steps state
export function createInitialSteps(): ExtractionSteps {
  return {
    websiteSearch: { status: "pending" },
    screenshot: { status: "pending" },
    logoExtraction: { status: "pending" },
    colorExtraction: { status: "pending" },
  };
}

// Helper to check if a string looks like a URL
export function isUrl(input: string): boolean {
  try {
    const url = new URL(
      input.startsWith("http") ? input : `https://${input}`
    );
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

// Helper to extract domain from URL
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
