import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const webSearch = defineTool({
  name: 'web_search',
  description:
    'Search the public web with Jina AI. Use this for current facts, news, documentation, and information that may have changed. Cite the returned source URLs in your answer.',
  input: v.object({
    query: v.pipe(v.string(), v.minLength(2), v.maxLength(500)),
  }),
  async run({ input, signal }) {
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) return { error: 'Web search is not configured.' };

    const jina = await fetch('https://s.jina.ai/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Return-Format': 'markdown',
        'X-With-Links-Summary': 'all',
      },
      body: JSON.stringify({ q: input.query, num: 5 }),
      signal,
    });

    if (jina.ok) return await jina.json();

    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!braveKey) return { error: `Jina search failed with HTTP ${jina.status}.` };

    const braveUrl = new URL('https://api.search.brave.com/res/v1/web/search');
    braveUrl.searchParams.set('q', input.query);
    braveUrl.searchParams.set('count', '5');
    const brave = await fetch(braveUrl, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': braveKey,
      },
      signal,
    });

    if (!brave.ok) {
      return {
        error: `Search providers failed (Jina HTTP ${jina.status}, Brave HTTP ${brave.status}).`,
      };
    }

    const data = (await brave.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    return {
      provider: 'brave',
      results: data.web?.results ?? [],
    };
  },
});
