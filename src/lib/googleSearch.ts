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
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('cx', this.searchEngineId);
      url.searchParams.append('q', query);
      url.searchParams.append('num', numResults.toString());

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status}`);
      }

      const data: GoogleSearchResponse = await response.json();
      
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
        return `**Source ${index + 1}:** [${item.title}](${item.link})\n${item.snippet}`;
      })
      .join('\n\n');
  }
}

export const googleSearchService = new GoogleSearchService();