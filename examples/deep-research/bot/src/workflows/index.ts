/**
 * @workflow DeepResearchWorkflow
 * @pattern Surface Research -> Structured Outline -> Parallel Deep Dive -> Report Assembly
 *
 * WHY THIS IS A WORKFLOW (not inline in the conversation):
 * Research involves dozens of web searches, page fetches, and LLM calls that take 2-10 minutes
 * total. Workflows provide durable execution with step-level checkpointing — if the process
 * fails at step 4/6, it resumes from step 4 rather than repeating all the web searches.
 *
 * THE 6-PHASE PIPELINE AND WHY EACH PHASE EXISTS:
 *
 * Phase 1 - surface-research:
 *   Broad initial web searches to understand the topic landscape. WHY this exists: The LLM
 *   needs context about the topic before it can create a meaningful report structure. Without
 *   surface research, the table of contents would be based on the LLM's training data, which
 *   may miss recent developments or niche aspects.
 *
 * Phase 2 - generate-toc:
 *   Creates a report structure (title + sections + research questions) using zai.extract.
 *   WHY zai.extract (not zai.text): We need structured data (arrays of sections with arrays
 *   of questions) that will be iterated over in Phase 3. zai.extract outputs typed data
 *   matching the TOCSchema, which is more reliable than parsing free-form text.
 *
 * Phase 3 - research-sections (step.map, parallel):
 *   Each section is researched independently and concurrently. For each section:
 *   a) Generate diverse search queries (not just the section title)
 *   b) Execute searches WITHOUT browsing pages (faster, get more URLs)
 *   c) Use zai.filter to select the best 5 pages from candidates (quality over quantity)
 *   d) Fetch selected pages (full content)
 *   e) Answer each research question using zai.answer with citations
 *
 *   WHY step.map (parallel): Each section is independent — researching "Market Trends" doesn't
 *   depend on "Technical Architecture". Parallelizing cuts total time by the section count.
 *
 *   WHY zai.filter for page selection: Without filtering, the LLM would read 20+ pages per
 *   section (slow, expensive, noisy). zai.filter uses LLM intelligence to select the 5 most
 *   authoritative and relevant pages, dramatically improving quality-per-token.
 *
 *   WHY zai.answer (not zai.text) for questions: zai.answer provides structured citations
 *   linking each claim to its source page. This enables the final report to include inline
 *   source links, which is critical for research credibility.
 *
 * Phase 4 - draft-report:
 *   Assembles all Q&A content into a cohesive markdown report using zai.text with "best" model.
 *   WHY "best" model: Report writing requires synthesizing information from multiple sections
 *   into coherent prose — this is the most reasoning-intensive step and benefits from the
 *   highest-quality model available.
 *
 * Phase 5 - generate-summary:
 *   Creates a standalone executive summary (TLDR) from the section findings.
 *   WHY a separate step (not part of Phase 4): The summary is displayed separately in the UI
 *   (above the fold) and needs to be independently generated to ensure it's truly standalone
 *   rather than just the report's first paragraph.
 *
 * Phase 6 - finalize:
 *   Prepends executive summary to report and marks the progress UI as complete.
 *   WHY a separate step: This ensures the final UI update only happens after ALL content is
 *   generated. If we updated the UI in Phase 4, the user would see "complete" before the
 *   summary exists.
 */
import { Workflow, z, actions, adk } from "@botpress/runtime";
import {
  updateResearchProgressComponent,
  type Source,
  type ResearchData,
} from "../utils/progress-component";
import {
  createActivity,
  updateActivity,
} from "../utils/research-activity";
import { fetchPages } from "../utils/fetch-page";

// Types for structured research — Zod schemas used by zai.extract to structure LLM output
const SectionSchema = z.object({
  title: z.string(),
  questions: z.array(z.string()),
});

const TOCSchema = z.object({
  reportTitle: z.string(),
  sections: z.array(SectionSchema),
});

const AnswerWithCitationSchema = z.object({
  question: z.string(),
  answer: z.string(),
  citations: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      favicon: z.string().optional(),
    })
  ),
});

const SectionContentSchema = z.object({
  title: z.string(),
  answers: z.array(AnswerWithCitationSchema),
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      favicon: z.string().optional(),
    })
  ),
});

export const DeepResearchWorkflow = new Workflow({
  name: "deep_research",
  input: z.object({
    messageId: z.string(),
    conversationId: z.string(),
    topic: z
      .string()
      .min(1)
      .describe("The topic to research, e.g., 'climate change'"),
  }),
  output: z.object({
    title: z.string().optional(),
    report: z.string().optional(),
    summary: z.string().optional(),
    sources: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        favicon: z.string().optional(),
      })
    ),
  }),
  state: z.object({}),
  timeout: "60m",
  handler: async ({ input, step }) => {
    const { messageId, topic } = input;
    const today = new Date().toISOString().split("T")[0];

    console.log("[WORKFLOW] Starting deep_research workflow", {
      messageId,
      topic,
    });

    // Helper to update UI - fetches activities from table automatically
    const updateUI = async (opts?: {
      progress?: number;
      sources?: Source[];
      status?: ResearchData["status"];
      result?: string;
      title?: string;
      summary?: string;
    }) => {
      await updateResearchProgressComponent(messageId, {
        topic,
        ...opts,
      });
    };

    // Helper to create an activity and return its ID
    const addActivity = async (opts: {
      type: "search" | "readPage" | "writing" | "thinking" | "pending";
      status: "pending" | "in_progress" | "done" | "error";
      text: string;
      favicon?: string;
      metadata?: Record<string, unknown>;
    }) => {
      return createActivity({
        messageId,
        ...opts,
      });
    };

    // ========================================
    // PHASE 1: Initial Surface Research
    // ========================================
    console.log("[WORKFLOW] Starting PHASE 1: surface-research");
    const initialInsights = await step("surface-research", async () => {
      console.log("[WORKFLOW] Inside surface-research step");

      const searchActivityId = await addActivity({
        type: "search",
        status: "in_progress",
        text: `Understanding the topic landscape for "${topic}"...`,
      });

      await updateUI({ progress: 2 });

      // Do broad initial searches to understand the topic
      const surfaceQueries = [
        topic,
        `${topic} overview`,
        `${topic} latest news ${today}`,
      ];

      const searchResults = await Promise.all(
        surfaceQueries.map((query) =>
          actions.browser.webSearch({
            query,
            count: 5,
            browsePages: true, // Get initial content for understanding
          })
        )
      );

      // Collect snippets and page content for initial understanding
      const snippets = searchResults
        .flatMap((r) => r.results)
        .map(
          (r) =>
            `${r.name}: ${r.snippet}${r.page?.content ? `\n${r.page.content.slice(0, 2000)}` : ""}`
        )
        .join("\n\n");

      // Extract key aspects and considerations
      const insights = await adk.zai.extract(
        `Based on the following search results about "${topic}", identify:
        1. The main aspects/subtopics that should be covered
        2. Key stakeholders or perspectives to consider
        3. Any controversies or multiple viewpoints that need balanced coverage
        4. Recent developments or news that should be included
        5. What makes this topic important or relevant

        SEARCH RESULTS:
        ${snippets.slice(0, 15000)}`,
        z.object({
          mainAspects: z.array(z.string()).describe("Key aspects to cover"),
          perspectives: z
            .array(z.string())
            .describe("Different perspectives/stakeholders"),
          controversies: z
            .array(z.string())
            .describe("Controversies or debates"),
          recentDevelopments: z
            .array(z.string())
            .describe("Recent news or developments"),
          importance: z.string().describe("Why this topic matters"),
        })
      );

      await updateActivity(searchActivityId, {
        status: "done",
        text: `Understood topic landscape: ${insights.mainAspects.length} aspects identified`,
      });

      await updateUI({ progress: 8 });

      console.log("[WORKFLOW] surface-research complete", {
        aspectsCount: insights.mainAspects.length,
      });
      return insights;
    });

    console.log(
      "[WORKFLOW] PHASE 1 complete, initialInsights:",
      JSON.stringify(initialInsights).slice(0, 200)
    );

    // ========================================
    // PHASE 2: Generate Report Title and TOC
    // ========================================
    console.log("[WORKFLOW] Starting PHASE 2: generate-toc");
    const toc = await step("generate-toc", async () => {
      console.log("[WORKFLOW] Inside generate-toc step");

      const planningActivityId = await addActivity({
        type: "writing",
        status: "in_progress",
        text: "Creating report structure...",
      });

      await updateUI({ progress: 10 });

      const structure = await adk.zai.extract(
        `You are creating a research report structure about "${topic}".

Based on the initial research insights:
- Main aspects: ${initialInsights.mainAspects.join(", ")}
- Perspectives: ${initialInsights.perspectives.join(", ")}
- Controversies: ${initialInsights.controversies.join(", ")}
- Recent developments: ${initialInsights.recentDevelopments.join(", ")}
- Importance: ${initialInsights.importance}

Create a professional report structure with:
1. A compelling, specific report title (not generic)
2. 3-5 main sections (NOT including conclusion - that comes later)
3. For each section, 2-4 specific research questions that need answering

The questions should be specific, answerable, and lead to substantive content.
Consider balance: if there are controversies, include questions that cover multiple perspectives.`,
        TOCSchema
      );

      await updateActivity(planningActivityId, {
        status: "done",
        text: `Created structure: ${structure.sections.length} sections`,
      });

      await updateUI({
        progress: 15,
        title: structure.reportTitle,
      });

      console.log("[WORKFLOW] generate-toc complete", {
        title: structure.reportTitle,
        sectionsCount: structure.sections.length,
      });
      return structure;
    });

    console.log(
      "[WORKFLOW] PHASE 2 complete, toc:",
      JSON.stringify(toc).slice(0, 300)
    );

    // ========================================
    // PHASE 3: Research Each Section in Parallel
    // ========================================
    console.log("[WORKFLOW] Starting PHASE 3: research-sections (step.map)");
    const sectionContents = await step.map(
      "research-section",
      toc.sections,
      async (section, { i: sectionIndex }) => {
        console.log(
          `[WORKFLOW] research-section[${sectionIndex}] starting:`,
          section.title
        );

        try {
          // Create activity for this section's research
          const sectionActivityId = await addActivity({
            type: "search",
            status: "in_progress",
            text: `Researching: ${section.title}`,
          });

          // Update progress (merge semantics prevent race conditions)
          await updateUI({
            progress: 20 + sectionIndex * 10,
            title: toc.reportTitle,
          });

          // Generate diverse search queries for this section
          const searchQueries = await adk.zai.extract(
            `Generate search queries to thoroughly research the section "${section.title}" about "${topic}".

Questions to answer:
${section.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

Generate 4-6 search queries that:
- Cover all the questions
- Include authoritative/official sources (e.g., if about a company, search for their official site)
- Include recent news (use date: ${today})
- Cover multiple perspectives if relevant
- Are specific enough to find quality sources`,
            z.object({
              queries: z.array(z.string()),
            })
          );

          // Execute searches WITHOUT browsing pages (faster, get more results)
          const searchResults = await Promise.all(
            searchQueries.queries.slice(0, 5).map((query: string) =>
              actions.browser
                .webSearch({
                  query,
                  count: 20, // Get more results
                  browsePages: false, // Don't browse yet - we'll filter first
                })
                .catch(() => ({ results: [] }))
            )
          );

          // Collect unique search results (without content yet)
          const candidatePages: Array<{
            url: string;
            title: string;
            snippet: string;
          }> = [];
          const seenUrls = new Set<string>();

          for (const result of searchResults) {
            for (const r of result.results) {
              if (r.url && !seenUrls.has(r.url)) {
                seenUrls.add(r.url);
                candidatePages.push({
                  url: r.url,
                  title: r.name,
                  snippet: r.snippet || "",
                });
              }
            }
          }

          console.log(
            `[WORKFLOW] research-section[${sectionIndex}] found ${candidatePages.length} candidate pages`
          );

          // Use zai.filter to select the best pages to read
          // Filter keeps items that match the condition
          let selectedPages = candidatePages;
          if (candidatePages.length > 5) {
            selectedPages = await adk.zai.filter(
              candidatePages,
              `Keep only if this is a highly relevant and authoritative page for researching "${section.title}" about "${topic}".

Questions we need to answer:
${section.questions.map((q: string) => `- ${q}`).join("\n")}

Keep pages that are:
- Official/authoritative sources (company sites, government, reputable news)
- Comprehensive (not just brief mentions)
- Relevant to the specific questions above

Reject pages that are:
- Irrelevant or off-topic
- Low quality or spam
- Duplicates of information already covered`
            );
            // Take top 5 after filtering
            selectedPages = selectedPages.slice(0, 5);
          }

          console.log(
            `[WORKFLOW] research-section[${sectionIndex}] selected ${selectedPages.length} pages to read`
          );

          // Create activities for reading pages
          const readActivities: string[] = [];
          for (const page of selectedPages) {
            const activityId = await addActivity({
              type: "readPage",
              status: "in_progress",
              text: page.title || page.url,
              favicon: `https://www.google.com/s2/favicons?domain=${new URL(page.url).hostname}&sz=32`,
            });
            readActivities.push(activityId);
          }

          await updateUI({ progress: 22 + sectionIndex * 10 });

          // Fetch the selected pages (try fetch first, fallback to browser)
          const pages =
            selectedPages.length > 0
              ? await fetchPages(selectedPages.map((p) => p.url))
              : [];

          console.log(
            `[WORKFLOW] research-section[${sectionIndex}] fetched ${pages.length} pages with content`
          );

          // Update read activities to done
          for (let i = 0; i < readActivities.length; i++) {
            const page = pages[i];
            await updateActivity(readActivities[i], {
              status: page ? "done" : "error",
              text: page?.title || selectedPages[i]?.title || selectedPages[i]?.url || "Page",
              favicon: page?.favicon,
            });
          }

          const sectionSources: Source[] = pages.map((p) => ({
            url: p.url,
            title: p.title,
            favicon: p.favicon,
          }));

          // Update UI with sources found (merge semantics will add to existing)
          await updateUI({
            progress: 25 + sectionIndex * 10,
            sources: sectionSources,
            title: toc.reportTitle,
          });

          // Answer each question using adk.zai.answer
          const answers: z.infer<typeof AnswerWithCitationSchema>[] = [];

          // Skip if no pages were found
          if (pages.length === 0) {
            console.log(
              `[WORKFLOW] research-section[${sectionIndex}] no pages found, skipping questions`
            );
          } else {
            for (const question of section.questions) {
              try {
                const result = await adk.zai
                  .with({ modelId: "best" })
                  .answer(pages, question, {
                    instructions: `Answer thoroughly with specific details, statistics, and facts when available.
                  If there are multiple perspectives, present them fairly.`,
                  });

                if (result.type === "answer") {
                  // Extract citation info (url, title, favicon) from the pages returned in citations
                  // Citations have an `item` property containing the page
                  const citations = (result.citations || []).map((citation) => {
                    const item = citation.item as { url: string; title: string; favicon?: string };
                    return {
                      url: item.url,
                      title: item.title,
                      favicon: item.favicon,
                    };
                  });

                  answers.push({
                    question,
                    answer: result.answer,
                    citations,
                  });
                } else {
                  // Fallback if no answer found
                  answers.push({
                    question,
                    answer: `Research on this question is inconclusive based on available sources.`,
                    citations: [],
                  });
                }
              } catch (err) {
                console.error(
                  `[WORKFLOW] research-section[${sectionIndex}] error answering question:`,
                  question,
                  err
                );
                // Continue with other questions
              }
            }
          }

          // Mark section research complete
          await updateActivity(sectionActivityId, {
            status: "done",
            text: `${section.title}: ${answers.length} questions answered`,
          });

          await updateUI({
            progress: 30 + sectionIndex * 12,
            title: toc.reportTitle,
          });

          console.log(`[WORKFLOW] research-section[${sectionIndex}] complete:`, {
            title: section.title,
            answersCount: answers.length,
            sourcesCount: sectionSources.length,
          });
          return {
            title: section.title,
            answers,
            sources: sectionSources,
          } as z.infer<typeof SectionContentSchema>;
        } catch (err) {
          console.error(
            `[WORKFLOW] research-section[${sectionIndex}] failed:`,
            section.title,
            err
          );
          // Return empty section on error - will be filtered out
          return {
            title: section.title,
            answers: [],
            sources: [],
          } as z.infer<typeof SectionContentSchema>;
        }
      }
    );

    console.log(
      "[WORKFLOW] PHASE 3 complete, sectionContents:",
      sectionContents ? `array of ${sectionContents.length}` : "undefined"
    );

    // Filter out any undefined results and collect all sources
    // sectionContents could be undefined if step.map fails entirely
    const validSections = (sectionContents || []).filter(
      (s): s is z.infer<typeof SectionContentSchema> =>
        s != null && typeof s?.title === "string"
    );

    console.log(
      "[WORKFLOW] validSections count:",
      validSections.length,
      "items:",
      validSections.map((s) => s?.title || "undefined")
    );

    // If no valid sections, throw an error to fail the workflow gracefully
    if (validSections.length === 0) {
      console.error(
        "[WORKFLOW] ERROR: No valid sections! sectionContents was:",
        sectionContents
      );
      throw new Error(
        "No valid research sections were generated. Please try again."
      );
    }

    const allSources: Source[] = [];
    const sourceUrlSet = new Set<string>();
    for (const section of validSections) {
      for (const source of section.sources || []) {
        if (source?.url && !sourceUrlSet.has(source.url)) {
          sourceUrlSet.add(source.url);
          allSources.push(source);
        }
      }
    }

    // ========================================
    // PHASE 4: Draft Final Report
    // ========================================
    console.log("[WORKFLOW] Starting PHASE 4: draft-report", {
      allSourcesCount: allSources.length,
    });
    const reportBody = await step("draft-report", async () => {
      console.log(
        "[WORKFLOW] Inside draft-report step, validSections:",
        validSections.length
      );

      const draftActivityId = await addActivity({
        type: "writing",
        status: "in_progress",
        text: "Drafting comprehensive report...",
      });

      await updateUI({
        progress: 80,
        sources: allSources,
        title: toc.reportTitle,
      });

      // Helper to get domain from URL for inline citations
      const getDomain = (url: string) => {
        try {
          return new URL(url).hostname.replace("www.", "");
        } catch {
          return url;
        }
      };

      // Build citation references for each answer
      const formatCitations = (citations: Array<{ url: string; title: string; favicon?: string }>) => {
        if (!citations || citations.length === 0) return "";
        const uniqueCitations = citations.filter(
          (c, i, arr) => arr.findIndex((x) => x.url === c.url) === i
        );
        return " " + uniqueCitations.map((c) => `[${getDomain(c.url)}](${c.url})`).join(" ");
      };

      // Combine all Q&A content for the LLM to rewrite into a cohesive report
      const allContent = validSections.map((section) => ({
        sectionTitle: section.title,
        content: section.answers.map((qa) => ({
          question: qa.question,
          answer: qa.answer,
          citationLinks: formatCitations(qa.citations),
        })),
      }));

      // Have the LLM write a proper report in ChatGPT style
      const reportContent = await adk.zai.with({ modelId: "best" }).text(
        `You are writing a professional research report about "${topic}".

Below is the research data organized by section. Transform this into a well-written, flowing report.

IMPORTANT FORMATTING RULES:
1. Use ## for main section headers (e.g., "## Section Title")
2. Use ### for subsection headers when introducing specific topics/entities (e.g., "### Company Name")
3. Use bullet points with **bold labels** for key attributes (e.g., "- **Target Market:** description here")
4. DO NOT use headers for questions - integrate the information naturally
5. Write in clear, professional prose that flows well
6. Keep the citation links exactly as provided - they appear like [domain.com](url) and should stay at the end of relevant sentences
7. DO NOT add any new information - only reorganize and rephrase the provided content

RESEARCH DATA:
${JSON.stringify(allContent, null, 2)}

Write the full report now. Start directly with the first section (no introduction needed - that comes separately).`,
        { length: 3000 }
      );

      // Generate conclusion
      const conclusionContent = await adk.zai.text(
        `Based on the research findings about "${topic}", write a brief conclusion (2-3 paragraphs) that:
1. Synthesizes the main themes
2. Highlights key takeaways
3. Provides perspective on implications

Key sections covered: ${validSections.map((s) => s.title).join(", ")}

Write in clear, professional prose.`,
        { length: 400 }
      );

      // Build final report
      const finalContent = `# ${toc.reportTitle}

${reportContent}

## Conclusion

${conclusionContent}
`;

      await updateActivity(draftActivityId, {
        status: "done",
        text: "Report drafted",
      });

      console.log(
        "[WORKFLOW] draft-report complete, finalContent length:",
        finalContent.length
      );
      return finalContent;
    });

    console.log(
      "[WORKFLOW] PHASE 4 complete, reportBody length:",
      reportBody?.length || "undefined"
    );

    // ========================================
    // PHASE 5: Generate Executive Summary (TLDR)
    // ========================================
    console.log("[WORKFLOW] Starting PHASE 5: generate-summary");
    const executiveSummary = await step("generate-summary", async () => {
      console.log("[WORKFLOW] Inside generate-summary step");

      const summaryActivityId = await addActivity({
        type: "writing",
        status: "in_progress",
        text: "Writing executive summary...",
      });

      await updateUI({
        progress: 95,
        sources: allSources,
        title: toc.reportTitle,
      });

      const summary = await adk.zai.text(
        `Write a concise executive summary (TLDR) for this research report about "${topic}".

Report Title: ${toc.reportTitle}

Key sections and findings:
${validSections
  .map(
    (s) =>
      `**${s.title}**:\n${s.answers.map((a) => `- ${a.question}: ${a.answer.slice(0, 150)}...`).join("\n")}`
  )
  .join("\n\n")}

Write a 1-2 paragraph executive summary that:
- Captures the essential findings
- Highlights what's most important for the reader to know
- Is suitable as a standalone summary

Write in clear, professional prose.`,
        { length: 300 }
      );

      await updateActivity(summaryActivityId, {
        status: "done",
        text: "Executive summary complete",
      });

      console.log(
        "[WORKFLOW] generate-summary complete, summary length:",
        summary.length
      );
      return summary;
    });

    console.log(
      "[WORKFLOW] PHASE 5 complete, executiveSummary length:",
      executiveSummary?.length || "undefined"
    );

    // ========================================
    // PHASE 6: Final Assembly
    // ========================================
    console.log("[WORKFLOW] Starting PHASE 6: finalize");
    const finalReport = await step("finalize", async () => {
      console.log("[WORKFLOW] Inside finalize step");
      // Prepend executive summary to report - remove the title from reportBody since we add it here
      const reportWithoutTitle = reportBody.replace(/^# .+\n\n/, "");

      const fullReport = `# ${toc.reportTitle}

## Executive Summary

${executiveSummary}

${reportWithoutTitle}`;

      await updateUI({
        progress: 100,
        sources: allSources,
        status: "done",
        result: fullReport,
        title: toc.reportTitle,
        summary: executiveSummary,
      });

      console.log(
        "[WORKFLOW] finalize complete, fullReport length:",
        fullReport.length
      );
      return fullReport;
    });

    console.log(
      "[WORKFLOW] PHASE 6 complete, finalReport length:",
      finalReport?.length || "undefined"
    );
    console.log("[WORKFLOW] Workflow complete! Returning output");

    return {
      title: toc.reportTitle,
      report: finalReport,
      summary: executiveSummary,
      sources: allSources,
    };
  },
});
