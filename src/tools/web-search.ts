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

    const response = await fetch('https://s.jina.ai/', {
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

    if (!response.ok) {
      return { error: `Jina search failed with HTTP ${response.status}.` };
    }

    return await response.json();
  },
});
