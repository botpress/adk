import { actions } from "@botpress/runtime";

export type PageContent = {
  url: string;
  title: string;
  content: string;
  favicon?: string;
};

/**
 * Extracts favicon URL from HTML, checking multiple patterns
 */
function extractFavicon(html: string, pageUrl: string): string | undefined {
  const urlObj = new URL(pageUrl);

  // Patterns to match various favicon declarations (ordered by preference)
  const patterns = [
    // Apple touch icon (usually high quality)
    /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i,
    // Standard icon with sizes (prefer larger)
    /<link[^>]*rel=["']icon["'][^>]*sizes=["']\d+x\d+["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']icon["'][^>]*sizes=["']\d+x\d+["']/i,
    // Standard favicon
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i,
    // SVG icon
    /<link[^>]*rel=["']icon["'][^>]*type=["']image\/svg\+xml["'][^>]*href=["']([^"']+)["']/i,
    // PNG icon
    /<link[^>]*rel=["']icon["'][^>]*type=["']image\/png["'][^>]*href=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      let favicon = match[1];
      // Make relative URLs absolute
      if (favicon.startsWith("//")) {
        favicon = `https:${favicon}`;
      } else if (favicon.startsWith("/")) {
        favicon = `${urlObj.origin}${favicon}`;
      } else if (!favicon.startsWith("http")) {
        favicon = `${urlObj.origin}/${favicon}`;
      }
      return favicon;
    }
  }

  // No favicon found
  return undefined;
}

/**
 * Fetches a page content - tries fetch first (faster), falls back to browser if needed.
 * This should be called inside a step() for durability.
 */
export async function fetchPage(url: string): Promise<PageContent | null> {
  // Try fetch first (faster for most pages)
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ResearchBot/1.0; +https://botpress.com)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (response.ok) {
      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : url;

      // Extract favicon
      const favicon = extractFavicon(html, url);

      // Strip HTML tags and extract text content
      // Remove script and style tags first
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();

      // Limit content length
      if (content.length > 15000) {
        content = content.slice(0, 15000) + "...";
      }

      if (content.length > 200) {
        console.log(`[fetchPage] Successfully fetched ${url} via fetch`);
        return { url, title, content, favicon };
      }
    }
  } catch (error) {
    console.log(`[fetchPage] Fetch failed for ${url}, trying browser:`, error);
  }

  // Fallback to browser action
  try {
    const result = await actions.browser.browsePages({
      urls: [url],
    });

    const page = result.results?.[0];
    if (page?.content) {
      console.log(`[fetchPage] Successfully fetched ${url} via browser`);
      return {
        url,
        title: page.title || url,
        content: page.content,
        favicon: page.favicon,
      };
    }
  } catch (error) {
    console.error(`[fetchPage] Browser also failed for ${url}:`, error);
  }

  return null;
}

/**
 * Fetches multiple pages in parallel.
 * This should be called inside a step() for durability.
 */
export async function fetchPages(urls: string[]): Promise<PageContent[]> {
  const results = await Promise.all(
    urls.map((url) => fetchPage(url).catch(() => null))
  );
  return results.filter((r): r is PageContent => r !== null);
}
