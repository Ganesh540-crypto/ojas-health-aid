/**
 * STAGE 2: Source Collection with Google Custom Search Engine
 * 
 * Process:
 * 1. Take queries from Stage 1
 * 2. For each query, search using Google CSE API
 * 3. Collect 10-15 authoritative sources
 * 4. Save to Firestore: pulse_queries_with_sources
 */

import { google } from "googleapis";
import { Firestore } from "@google-cloud/firestore";
import { TrendingQuery, SourceInfo, QueryWithSources } from "./types";
import crypto from "crypto";

// Hardcoded fallbacks for API keys
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || 
                              process.env.VITE_GOOGLE_SEARCH_API_KEY || 
                              "AIzaSyBl0pHldOtJr2l0VmgLQpcWelQ9oJ8--E0";
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 
                                process.env.VITE_GOOGLE_SEARCH_ENGINE_ID || 
                                "748584bebb02646c9";

const firestore = new Firestore();

function sha1(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex');
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export async function collectSourcesForQuery(query: TrendingQuery): Promise<QueryWithSources> {
  console.log(`[Stage 2] Collecting sources for: "${query.query}"`);
  
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    throw new Error('Google Search API credentials required');
  }
  
  try {
    const customsearch = google.customsearch('v1');
    
    const response = await customsearch.cse.list({
      auth: GOOGLE_SEARCH_API_KEY,
      cx: GOOGLE_SEARCH_ENGINE_ID,
      q: query.query,
      num: 10,  // Get 10 results per query
    });
    
    const sources: SourceInfo[] = [];
    
    if (response.data.items) {
      for (const item of response.data.items) {
        if (item.link) {
          sources.push({
            title: item.title || 'Untitled',
            url: item.link,
            snippet: item.snippet || '',
            domain: extractDomain(item.link)
          });
        }
      }
    }
    
    console.log(`[Stage 2] ✓ Found ${sources.length} sources for "${query.query}"`);
    
    return {
      query: query.query,
      category: query.category,
      priority: query.priority,
      sources: sources,
      collectedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`[Stage 2] Error collecting sources for "${query.query}":`, error);
    // Return empty sources rather than failing
    return {
      query: query.query,
      category: query.category,
      priority: query.priority,
      sources: [],
      collectedAt: new Date().toISOString()
    };
  }
}

export async function collectAndSaveAllSources(queries: TrendingQuery[]): Promise<QueryWithSources[]> {
  console.log(`[Stage 2] Collecting sources for ${queries.length} queries (PARALLEL with batching)...`);
  
  const allResults: QueryWithSources[] = [];
  
  // Process in larger batches for speed (10 parallel requests)
  const BATCH_SIZE = 10;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    
    console.log(`[Stage 2] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(queries.length / BATCH_SIZE)}`);
    
    const results = await Promise.allSettled(
      batch.map(async (query) => {
        const queryWithSources = await collectSourcesForQuery(query);
        
        // Save to Firestore if we have sources
        if (queryWithSources.sources.length > 0) {
          const id = sha1(queryWithSources.query).slice(0, 20);
          
          await firestore.collection('pulse_queries_with_sources').doc(id).set({
            query: queryWithSources.query,
            category: queryWithSources.category,
            priority: queryWithSources.priority,
            sources: queryWithSources.sources,
            sourceCount: queryWithSources.sources.length,
            collectedAt: queryWithSources.collectedAt,
            synthesized: false,
          });
          
          return { success: true, queryWithSources };
        }
        return { success: false, queryWithSources };
      })
    );
    
    // Collect successful results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        allResults.push(result.value.queryWithSources);
      }
    });
    
    // Small delay between batches
    if (i + BATCH_SIZE < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const successCount = allResults.length;
  const failCount = queries.length - successCount;
  
  console.log(`[Stage 2] ✓ Complete: ${successCount} with sources, ${failCount} failed`);
  
  return allResults;
}
