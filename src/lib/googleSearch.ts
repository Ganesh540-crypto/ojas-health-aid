import axios from 'axios';

export interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  htmlTitle: string;
  htmlSnippet: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

export class GoogleSearchService {
  private apiKey: string;
  private searchEngineId: string;

  constructor() {
    // Read from Vite env variables
  this.apiKey = (import.meta.env?.VITE_GOOGLE_SEARCH_API_KEY as string) || '';
  this.searchEngineId = (import.meta.env?.VITE_GOOGLE_SEARCH_ENGINE_ID as string) || '';
    if (!this.apiKey || !this.searchEngineId) {
      console.warn('Google Search env vars missing: VITE_GOOGLE_SEARCH_API_KEY or VITE_GOOGLE_SEARCH_ENGINE_ID');
    }
  }

  async search(query: string, numResults: number = 5): Promise<GoogleSearchItem[]> {
    if (!this.apiKey || !this.searchEngineId) {
      return [];
    }
    try {
      const response = await axios.get(
        `https://www.googleapis.com/customsearch/v1`,
        {
          params: {
            key: this.apiKey,
            cx: this.searchEngineId,
            q: query,
            num: numResults.toString(),
            gl: 'IN',
            hl: 'en',
            lr: 'lang_en',
            safe: 'off',
          },
        }
      );

      const data: GoogleSearchResponse = response.data;
      return data.items || [];
    } catch (error) {
      console.error('Google Search API Error:', error);
      return [];
    }
  }

  formatSearchResults(results: GoogleSearchItem[]): string {
    if (results.length === 0) return 'No search results found.';
    // Allow up to 6 now (caller may cap earlier)
    return results.slice(0, 6).map((item, i) => {
      let domain = '';
      try {
        domain = new URL(item.link).hostname.replace(/^www\./,'');
      } catch (e) {
        // Malformed URL; leave domain empty.
        domain = '';
      }
      const snippet = (item.snippet || '').replace(/\s+/g,' ').trim().slice(0,260);
      return `**${i+1}. ${item.title}**\nDomain: ${domain}\nURL: ${item.link}\nSnippet: ${snippet}`;
    }).join('\n\n');
  }
}

export const googleSearchService = new GoogleSearchService();