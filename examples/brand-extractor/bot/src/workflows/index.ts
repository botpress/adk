import { Workflow, z, actions, context, adk } from "@botpress/runtime";
import {
  updateBrandProgressComponent,
  BrandData,
  ColorTheme,
  createInitialSteps,
  isUrl,
  extractDomain,
} from "../utils/progress-component";
import extractPaletteScript from "../utils/extract-palette-script";

// Schema for final brand theme extraction
const BrandThemes = z.object({
  lightTheme: ColorTheme,
  darkTheme: ColorTheme,
  defaultTheme: z
    .enum(["light", "dark"])
    .describe("Which theme the website currently uses"),
  borderRadius: z
    .number()
    .min(0.5)
    .max(4)
    .describe("Border radius style in rem units"),
});

export const BrandExtractionWorkflow = new Workflow({
  name: "brand_extraction",
  input: z.object({
    messageId: z.string(),
    conversationId: z.string(),
    input: z.string().describe("Company name or website URL"),
  }),
  output: z.object({
    brandData: BrandData.optional(),
    error: z.string().optional(),
  }),
  state: z.object({}),
  timeout: "10m",
  handler: async ({ input, step }) => {
    const { messageId, input: userInput } = input;

    console.log("[WORKFLOW] Starting brand_extraction workflow", {
      messageId,
      userInput,
    });

    // Determine if input is URL or company name
    const inputIsUrl = isUrl(userInput);
    const companyName = inputIsUrl ? extractDomain(userInput) : userInput;

    // ========================================
    // STEP 1: Find Website (if needed)
    // ========================================
    console.log("[WORKFLOW] STEP 1: find-website");
    const websiteUrl = await step("find-website", async () => {
      if (inputIsUrl) {
        const url = userInput.startsWith("http")
          ? userInput
          : `https://${userInput}`;

        await updateBrandProgressComponent(messageId, {
          companyName,
          websiteUrl: url,
          steps: {
            ...createInitialSteps(),
            websiteSearch: { status: "done", url },
          },
        });

        return url;
      }

      // Search for the company website
      await updateBrandProgressComponent(messageId, {
        companyName,
        steps: {
          ...createInitialSteps(),
          websiteSearch: { status: "in_progress" },
        },
      });

      const searchResult = await actions.browser.webSearch({
        query: `${userInput} official website`,
        count: 3,
        browsePages: false,
      });

      if (searchResult.results.length === 0) {
        throw new Error(`Could not find website for "${userInput}"`);
      }

      const url = searchResult.results[0].url;

      await updateBrandProgressComponent(messageId, {
        companyName,
        websiteUrl: url,
        steps: {
          ...createInitialSteps(),
          websiteSearch: { status: "done", url },
        },
      });

      return url;
    });

    console.log("[WORKFLOW] STEP 1 complete:", websiteUrl);

    // ========================================
    // STEP 2: Discover Important Pages
    // ========================================
    console.log("[WORKFLOW] STEP 2: discover-pages");
    const pagesToAnalyze = await step("discover-pages", async () => {
      const domain = extractDomain(websiteUrl);

      // Search for pages on this website
      const searchResult = await actions.browser.webSearch({
        query: `site:${domain}`,
        count: 20,
        browsePages: false,
      });

      // Collect all candidate pages (homepage + search results)
      const candidatePages: Array<{ url: string; name: string }> = [
        { url: websiteUrl, name: "Homepage" },
      ];

      for (const result of searchResult.results) {
        try {
          const resultDomain = extractDomain(result.url);
          if (
            resultDomain === domain &&
            !candidatePages.some((p) => p.url === result.url)
          ) {
            candidatePages.push({ url: result.url, name: result.name || "" });
          }
        } catch {
          // Skip invalid URLs
        }
      }

      // Use zai.filter to keep only the most important pages for brand extraction
      const filteredPages = await adk.zai.filter(
        candidatePages,
        "Keep only the top 3 most important pages for extracting brand colors and visual identity. Prioritize: 1) Homepage (always keep), 2) Pages that showcase the brand visually like About, Features, or Product pages, 3) Marketing pages with rich visual design. Exclude: blog posts, documentation, legal pages, login/signup pages, and API references."
      );

      const pages = filteredPages.map((p) => p.url);
      console.log("[WORKFLOW] Pages to analyze:", pages);
      return pages;
    });

    console.log("[WORKFLOW] STEP 2 complete:", pagesToAnalyze);

    // ========================================
    // STEP 3: Extract Logo
    // ========================================
    console.log("[WORKFLOW] STEP 3: extract-logo");
    const logoUrl = await step("extract-logo", async () => {
      await updateBrandProgressComponent(messageId, {
        companyName,
        websiteUrl,
        steps: {
          ...createInitialSteps(),
          websiteSearch: { status: "done", url: websiteUrl },
          logoExtraction: { status: "in_progress" },
        },
      });

      try {
        const domain = extractDomain(websiteUrl);
        const result = await actions.browser.getWebsiteLogo({
          domain,
          size: "256",
        });

        await updateBrandProgressComponent(messageId, {
          companyName,
          websiteUrl,
          steps: {
            ...createInitialSteps(),
            websiteSearch: { status: "done", url: websiteUrl },
            logoExtraction: { status: "done", logoUrl: result.logoUrl },
          },
        });

        return result.logoUrl;
      } catch {
        console.log("[WORKFLOW] Logo extraction failed, continuing...");

        await updateBrandProgressComponent(messageId, {
          companyName,
          websiteUrl,
          steps: {
            ...createInitialSteps(),
            websiteSearch: { status: "done", url: websiteUrl },
            logoExtraction: { status: "error", error: "Logo not found" },
          },
        });

        return undefined;
      }
    });

    console.log("[WORKFLOW] STEP 3 complete:", logoUrl);

    // ========================================
    // STEP 4: Capture Screenshots of All Pages (in parallel)
    // ========================================
    console.log("[WORKFLOW] STEP 4: take-screenshots");
    await updateBrandProgressComponent(messageId, {
      companyName,
      websiteUrl,
      steps: {
        ...createInitialSteps(),
        websiteSearch: { status: "done", url: websiteUrl },
        logoExtraction: logoUrl
          ? { status: "done", logoUrl }
          : { status: "error", error: "Logo not found" },
        screenshot: { status: "in_progress" },
      },
    });

    // Take screenshots in parallel using step.map
    const screenshotResults = await step.map(
      "screenshot",
      pagesToAnalyze,
      async (pageUrl) => {
        console.log(`[WORKFLOW] Taking screenshot of: ${pageUrl}`);
        const result = await actions.browser.captureScreenshot({
          url: pageUrl,
          javascriptToInject: extractPaletteScript,
          width: 1280,
          height: 800,
          fullPage: false,
        });

        return {
          url: pageUrl,
          imageUrl: result.imageUrl,
        };
      },
      {
        // Do 5 screenshots in parallel with up to 3 attempts each
        concurrency: 5,
        maxAttempts: 3,
      }
    );

    // Filter out failed screenshots
    const screenshots = screenshotResults.filter(
      (r): r is { url: string; imageUrl: string } =>
        r !== null && r !== undefined
    );

    if (screenshots.length === 0) {
      throw new Error("Failed to capture any screenshots");
    }

    // Update with first screenshot as preview
    await updateBrandProgressComponent(messageId, {
      companyName,
      websiteUrl,
      steps: {
        ...createInitialSteps(),
        websiteSearch: { status: "done", url: websiteUrl },
        logoExtraction: logoUrl
          ? { status: "done", logoUrl }
          : { status: "error", error: "Logo not found" },
        screenshot: { status: "done", imageUrl: screenshots[0].imageUrl },
      },
    });

    console.log(
      "[WORKFLOW] STEP 4 complete:",
      screenshots.length,
      "screenshots"
    );

    // ========================================
    // STEP 5: Analyze All Screenshots & Extract Brand
    // ========================================
    console.log("[WORKFLOW] STEP 5: extract-brand");
    const themeData = await step("extract-brand", async () => {
      await updateBrandProgressComponent(messageId, {
        companyName,
        websiteUrl,
        steps: {
          ...createInitialSteps(),
          websiteSearch: { status: "done", url: websiteUrl },
          screenshot: { status: "done", imageUrl: screenshots[0].imageUrl },
          logoExtraction: logoUrl
            ? { status: "done", logoUrl }
            : { status: "error", error: "Logo not found" },
          colorExtraction: { status: "in_progress" },
        },
      });

      const cognitive = context.get("cognitive");

      // Build multipart content with all screenshots
      const imageContent: Array<
        { type: "text"; text: string } | { type: "image"; url: string }
      > = [
        {
          type: "text",
          text: `Analyze these ${screenshots.length} screenshots from the ${companyName} website and describe the visual brand identity.

For each screenshot, describe:
- What page it appears to be (homepage, pricing, about, etc.)
- The exact HEX colors visible in the color overlay bar at the top of each screenshot
- How colors are used (buttons, backgrounds, text, links, headers)
- The overall visual style and theme (light or dark)
- Border radius style (sharp, slightly rounded, very rounded)

IMPORTANT: Each screenshot has a dark overlay bar at the TOP showing colors extracted from the website's CSS. Use these EXACT HEX values.`,
        },
      ];

      // Add all screenshots
      for (let i = 0; i < screenshots.length; i++) {
        imageContent.push({
          type: "text",
          text: `\n\nScreenshot ${i + 1} (${screenshots[i].url}):`,
        });
        imageContent.push({
          type: "image",
          url: screenshots[i].imageUrl,
        });
      }

      console.log("[WORKFLOW] Analyzing all screenshots with vision...");
      const response = await cognitive.generateContent({
        model: "best",
        systemPrompt: `You are a brand design expert analyzing website screenshots to extract brand identity.

Provide a detailed visual analysis of the brand colors and style. Focus on:
1. Primary brand color - the main color used for key UI elements like buttons and links
2. Secondary color - supporting brand color
3. Accent color - highlight/CTA color
4. Background colors - main page backgrounds
5. Text colors - headings and body text
6. Overall theme - is this a light or dark themed website?
7. Border radius style - are corners sharp, slightly rounded, or very rounded?

Always use exact HEX values from the color overlay bars shown at the top of screenshots.
Describe what you see in natural language - be specific about colors and where they appear.`,
        messages: [
          {
            role: "user",
            type: "multipart",
            content: imageContent,
          },
        ],
      });

      const visualDescription = response.output.choices;
      console.log(
        "[WORKFLOW] Visual analysis complete, extracting brand data..."
      );

      // Use zai.extract to get structured brand data from the description
      const result = await adk.zai.extract(visualDescription, BrandThemes);

      await updateBrandProgressComponent(messageId, {
        companyName,
        websiteUrl,
        steps: {
          ...createInitialSteps(),
          websiteSearch: { status: "done", url: websiteUrl },
          screenshot: { status: "done", imageUrl: screenshots[0].imageUrl },
          logoExtraction: logoUrl
            ? { status: "done", logoUrl }
            : { status: "error", error: "Logo not found" },
          colorExtraction: { status: "done" },
        },
      });

      return result;
    });

    console.log("[WORKFLOW] STEP 5 complete");

    // ========================================
    // STEP 6: Finalize
    // ========================================
    console.log("[WORKFLOW] STEP 6: finalize");
    const brandData = await step("finalize", async () => {
      const finalBrandData: BrandData = {
        companyName,
        websiteUrl,
        logoUrl,
        screenshotUrl: screenshots[0].imageUrl,
        lightTheme: themeData.lightTheme,
        darkTheme: themeData.darkTheme,
        defaultTheme: themeData.defaultTheme,
        borderRadius: themeData.borderRadius,
      };

      await updateBrandProgressComponent(messageId, {
        status: "done",
        companyName,
        websiteUrl,
        steps: {
          websiteSearch: { status: "done", url: websiteUrl },
          screenshot: { status: "done", imageUrl: screenshots[0].imageUrl },
          logoExtraction: logoUrl
            ? { status: "done", logoUrl }
            : { status: "error", error: "Logo not found" },
          colorExtraction: { status: "done" },
        },
        brandData: finalBrandData,
      });

      return finalBrandData;
    });

    console.log("[WORKFLOW] Complete!", brandData);

    return { brandData };
  },
});
