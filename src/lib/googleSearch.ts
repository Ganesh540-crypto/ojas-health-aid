import axios from 'axios';

interface GoogleSearchItem {
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
    // Using demo API key - in production, this should come from Supabase secrets
    this.apiKey = 'AIzaSyBl0pHldOtJr2l0VmgLQpcWelQ9oJ8--E0';
    this.searchEngineId = '748584bebb02646c9';
  }

  async search(query: string, numResults: number = 5): Promise<GoogleSearchItem[]> {
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
    if (results.length === 0) {
      return 'No search results found.';
    }

    return results
      .slice(0, 3) // Limit to top 3 results for context
      .map((item, index) => {
        let domain = '';
        try { domain = new URL(item.link).hostname.replace(/^www\./, ''); } catch {}
        const snippet = (item.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 220);
        return `**Source ${index + 1}:** [${item.title}](${item.link}) - ${domain}\n${snippet}`;
      })
      .join('\n\n');
  }
}

export const googleSearchService = new GoogleSearchService();