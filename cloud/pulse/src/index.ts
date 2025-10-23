/**
 * Ojas Pulse - 3-Stage Article Generation Pipeline
 * 
 * STAGE 1: Topic Discovery (Gemini + Grounded Web Search)
 *   → Gemini searches web for trending news
 *   → Returns categorized queries
 * 
 * STAGE 2: Source Collection (Google CSE)
 *   → For each query, search Google CSE
 *   → Collect 10-15 authoritative sources
 *   → Save to Firestore: pulse_queries_with_sources
 * 
 * STAGE 3: Article Synthesis (Gemini + URL Context)
 *   → Read all source URLs
 *   → Synthesize comprehensive article with citations
 *   → Save to Firestore: pulse_articles
 * 
 * Environment Variables:
 *   - GEMINI_API_KEY (required for Stage 1 & 3)
 *   - GOOGLE_SEARCH_API_KEY (required for Stage 2)
 *   - GOOGLE_SEARCH_ENGINE_ID (required for Stage 2)
 */

import { discoverTrendingTopics } from "./stage1-topic-discovery";
import { collectAndSaveAllSources } from "./stage2-source-collection";
import { synthesizeAllPendingArticles } from "./stage3-article-synthesis";

/**
 * HTTP Endpoint: Run Complete Pipeline
 * 
 * Query params:
 *   - perCategory: Topics per category (default: 25, for 150 total across 6 categories)
 *   - stage: Run specific stage only (1, 2, 3, or 'all')
 * 
 * Scheduled batches:
 *   - Morning: 125 articles (25 per category × 5 categories)
 *   - Afternoon: 125 articles
 *   - Evening: 125 articles
 *   - Night: 125 articles
 *   - Total: 500 articles/day
 */
export async function generateArticles(req: any, res: any) {
  try {
    console.log('========================================');
    console.log('[Pipeline] START - Ojas Pulse 3-Stage Pipeline');
    console.log('========================================');
    
    const perCategory = parseInt(req.query.perCategory || '25', 10);
    const stage = req.query.stage || 'all';
    
    console.log(`[Pipeline] Configuration:`);
    console.log(`[Pipeline]   - Topics per category: ${perCategory}`);
    console.log(`[Pipeline]   - Total expected: ${perCategory * 6} articles`);
    console.log(`[Pipeline]   - Stage: ${stage}`);
    
    const results: any = {
      stage1: { status: 'skipped', queries: 0 },
      stage2: { status: 'skipped', queriesWithSources: 0 },
      stage3: { status: 'skipped', articles: 0 }
    };
    
    // STAGE 1: Topic Discovery (parallel across categories)
    if (stage === 'all' || stage === '1') {
      try {
        console.log('\n[Pipeline] ===== STAGE 1: TOPIC DISCOVERY (PARALLEL) =====');
        const queries = await discoverTrendingTopics(perCategory);
        results.stage1 = { status: 'success', queries: queries.length };
        
        // STAGE 2: Source Collection (parallel batches)
        if (stage === 'all' || stage === '2') {
          console.log('\n[Pipeline] ===== STAGE 2: SOURCE COLLECTION (PARALLEL) =====');
          const queriesWithSources = await collectAndSaveAllSources(queries);
          results.stage2 = { status: 'success', queriesWithSources: queriesWithSources.length };
          
          // STAGE 3: Article Synthesis (parallel)
          if (stage === 'all') {
            console.log('\n[Pipeline] ===== STAGE 3: ARTICLE SYNTHESIS (PARALLEL) =====');
            const articlesCreated = await synthesizeAllPendingArticles(queriesWithSources.length);
            results.stage3 = { status: 'success', articles: articlesCreated };
          }
        }
      } catch (error: any) {
        console.error('[Pipeline] Error:', error);
        results.stage1 = { status: 'error', error: error.message };
      }
    }
    
    // STAGE 3 only (synthesize pending queries)
    if (stage === '3') {
      console.log('\n[Pipeline] ===== STAGE 3: ARTICLE SYNTHESIS (PARALLEL) =====');
      try {
        const limit = parseInt(req.query.limit || '150', 10);
        const articlesCreated = await synthesizeAllPendingArticles(limit);
        results.stage3 = { status: 'success', articles: articlesCreated };
      } catch (error: any) {
        console.error('[Pipeline] Stage 3 error:', error);
        results.stage3 = { status: 'error', error: error.message };
      }
    }
    
    console.log('\n========================================');
    console.log('[Pipeline] COMPLETE');
    console.log('========================================');
    console.log('[Pipeline] Results:');
    console.log(`[Pipeline]   Stage 1: ${results.stage1.status} - ${results.stage1.queries || 0} queries`);
    console.log(`[Pipeline]   Stage 2: ${results.stage2.status} - ${results.stage2.queriesWithSources || 0} queries with sources`);
    console.log(`[Pipeline]   Stage 3: ${results.stage3.status} - ${results.stage3.articles || 0} articles`);
    
    res.status(200).json({
      ok: true,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Pipeline] Fatal error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}

/**
 * HTTP Endpoint: Health Check
 */
export async function healthCheck(req: any, res: any) {
  res.status(200).json({
    ok: true,
    service: 'Ojas Pulse',
    version: '3.0.0',
    stages: ['topic-discovery', 'source-collection', 'article-synthesis']
  });
}
