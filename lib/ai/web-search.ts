/**
 * Web Search Grounding Helper for AbhiAI
 * Provides real-time context and search grounding for live web queries.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function fetchWebGroundingContext(query: string): Promise<{ contextText: string; sources: SearchResult[] }> {
  try {
    const encodedQuery = encodeURIComponent(query.slice(0, 200));
    // DuckDuckGo Instant Answer API / HTML Lite query
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      return { contextText: '', sources: [] };
    }

    const data = await res.json();
    const sources: SearchResult[] = [];
    const snippets: string[] = [];

    if (data.AbstractText) {
      snippets.push(data.AbstractText);
      if (data.AbstractURL) {
        sources.push({
          title: data.Heading || 'DuckDuckGo Knowledge',
          url: data.AbstractURL,
          snippet: data.AbstractText
        });
      }
    }

    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 4)) {
        if (topic.Text && topic.FirstURL) {
          snippets.push(topic.Text);
          sources.push({
            title: topic.Text.slice(0, 50) + '...',
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      }
    }

    if (snippets.length === 0) {
      return { contextText: '', sources: [] };
    }

    const contextText = `[REAL-TIME WEB SEARCH RESULTS FOR: "${query}"]\n` + 
      snippets.map((s, idx) => `[Source ${idx + 1}]: ${s}`).join('\n') + 
      `\n\nInstructions: Integrate the relevant facts from the real-time search above into your answer naturally.`;

    return { contextText, sources };
  } catch (error) {
    console.warn('Web search grounding error:', error);
    return { contextText: '', sources: [] };
  }
}
