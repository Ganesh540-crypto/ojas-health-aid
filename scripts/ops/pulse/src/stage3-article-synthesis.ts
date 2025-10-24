/**
 * STAGE 3: Article Synthesis with Gemini + URL Context
 * 
 * Enhancements:
 * - Structured sections with subheadings
 * - Superscript citations at end of sentences
 * - 500-1000 words total across 3-5 sections
 * - Image extraction from sources
 * - Parallel processing support
 */

import { GoogleGenAI } from "@google/genai";
import { Firestore } from "@google-cloud/firestore";
import { QueryWithSources, PulseArticle, ArticleSection, ArticleSentence } from "./types";
import { findFirstImageFromSources } from "./imageExtractor";
import crypto from "crypto";

// Hardcoded fallback for API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 
                       process.env.VITE_GEMINI_API_KEY || 
                       "AIzaSyCgpMLX4VzKFGpzb12_kvo7cSSiETsMh-4";
const firestore = new Firestore();

function sha1(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex');
}

const SYNTHESIS_PROMPT = `You are an expert journalist writing for Ojas Pulse, a trusted news platform.

**CRITICAL ARTICLE STRUCTURE:**
1. Start with an INTRODUCTION section (NO heading, 2-4 sentences overview)
2. Follow with 2-4 SECTIONS with DYNAMIC subheadings based on content
3. Total 220-500 words across ALL sections (STRICT LIMIT)
4. Each section: 3-5 sentences (clean text, NO citations embedded)

**Introduction (First Section - NO heading):**
- Provide a brief 2-4 sentence overview of the topic
- Set context and explain why it matters
- This text appears directly after the title (no subheading)
- Must have its own sourceRefs for each sentence

**Dynamic Section Guidelines:**
- Create 2-4 sections AFTER the introduction
- Generate subheadings based on ACTUAL CONTENT (NOT predefined)
- Subheadings should be specific and descriptive
- Examples: "New Research Findings", "Impact on Communities", "Government Response", "Scientific Breakthrough Details", etc.
- DO NOT use generic headings like "Context & Background" or "Key Developments"
- Tailor headings to the specific story

**SOURCE TRACKING (VERY IMPORTANT):**
- Read ALL provided source URLs thoroughly
- For EACH sentence, track which source numbers support it
- Source numbers: [1] = first URL, [2] = second URL, etc.
- Store source references SEPARATELY (not in text)
- Write CLEAN sentences without any citation markers

**Writing Style:**
- Professional journalism (like BBC, Reuters, AP News)
- Clear, accessible language (avoid jargon)
- Active voice, engaging narrative
- Each section heading must be unique and content-specific

**Output JSON Format (example):**
\`\`\`json
{
  "title": "Headline (6-10 words)",
  "introduction": "1-3 sentence introduction paragraph providing overview and context.",
  "sourceRefs": [1, 2],
  "sections": [
    {
      "heading": "",
      "sentences": [
        {
          "text": "Introduction sentence one providing overview.",
          "sourceRefs": [1, 2]
        },
        {
          "text": "Introduction sentence two setting context.",
          "sourceRefs": [2]
        }
      ]
    },
    {
      "heading": "Specific Content-Based Heading",
      "sentences": [
        {
          "text": "First sentence with facts from sources.",
          "sourceRefs": [1, 3]
        },
        {
          "text": "Second sentence with more information.",
          "sourceRefs": [2, 3, 5]
        }
      ]
    },
    {
      "heading": "Another Dynamic Heading Based On Content",
      "sentences": [
        {
          "text": "Important finding from research.",
          "sourceRefs": [4, 6]
        }
      ]
    }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "urgency": "high",
  "locationRelevance": ["India", "Global"]
}
\`\`\`

**CRITICAL REQUIREMENTS:**
- MUST include "introduction" field with 2-4 sentence overview
- First section MUST have empty heading "" (introduction paragraph, same content as introduction field)
- Following sections MUST have dynamic, content-specific headings
- Return ONLY valid JSON
- Write CLEAN text (no +N, no [1], no citations in text)
- Track sourceRefs for EVERY sentence
- 3-5 sections TOTAL (1 intro + 2-4 content sections), 220-500 words
- Each sentence must have sourceRefs array
- Use actual source numbers that match the URL list provided`;

// No conversion needed - we use +N format directly

export async function synthesizeArticle(queryWithSources: QueryWithSources): Promise<PulseArticle | null> {
  console.log(`[Stage 3] Synthesizing article for: "${queryWithSources.query}"`);
  console.log(`[Stage 3] Using ${queryWithSources.sources.length} sources`);
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required');
  }
  
  if (queryWithSources.sources.length === 0) {
    console.log(`[Stage 3] ✗ No sources for "${queryWithSources.query}"`);
    return null;
  }
  
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  try {
    // Prepare URLs
    const urlsList = queryWithSources.sources
      .map((source, idx) => `[${idx + 1}] ${source.url} - ${source.title}`)
      .join('\n');
    
    const userPrompt = `Write a structured article about: "${queryWithSources.query}"

**Sources (${queryWithSources.sources.length} URLs):**
${urlsList}

Category: ${queryWithSources.category}

Read ALL URLs and write 3-5 sections with subheadings. Use superscript citations ¹²³⁴ at end of sentences.`;
    
    const urlContextTool = { urlContext: {} };
    const config = {
      temperature: 0.5,
      maxOutputTokens: 4096,
      tools: [urlContextTool]
    };
    
    console.log(`[Stage 3] Asking Gemini to read ${queryWithSources.sources.length} URLs...`);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: SYNTHESIS_PROMPT + '\n\n' + userPrompt,
      config
    });
    
    let text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.log(`[Stage 3] ✗ Empty response`);
      return null;
    }
    
    // Clean JSON
    text = text.trim();
    text = text.replace(/^```json\s*/gm, '').replace(/\s*```$/gm, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError: any) {
      console.error(`[Stage 3] JSON parse error:`, parseError.message);
      console.error(`[Stage 3] First 300 chars:`, text.substring(0, 300));
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }
    
    // Validate sections
    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length < 3) {
      console.warn(`[Stage 3] Invalid sections, creating default structure`);
      parsed.sections = [
        { 
          heading: "Overview", 
          sentences: [{ text: "Content not available.", sourceRefs: [] }]
        }
      ];
    }
    
    // Extract introduction - prefer direct field, fall back to first section with empty heading
    let introduction = parsed.introduction || '';
    if (!introduction) {
      const introSection = parsed.sections.find((s: ArticleSection) => !s.heading || s.heading === '');
      introduction = introSection 
        ? introSection.sentences.map((s: any) => s.text).join(' ')
        : '';
    }
    
    // Build summary as ONLY introduction text (for clean preview cards)
    const fullSummary = introduction;
    
    const wordCount = parsed.sections
      .map((s: ArticleSection) => s.sentences.map((sent: any) => sent.text).join(' '))
      .join(' ')
      .split(/\s+/).length;
    console.log(`[Stage 3] Article: ${parsed.sections.length} sections, ${wordCount} words`);
    
    // Extract image from sources
    console.log(`[Stage 3] Extracting image from sources...`);
    const imageUrl = await findFirstImageFromSources(queryWithSources.sources.map(s => s.url));
    
    const article: PulseArticle = {
      title: parsed.title,
      introduction: introduction,
      summary: fullSummary,
      sections: parsed.sections,
      category: queryWithSources.category,
      tags: parsed.tags || [],
      urgency: parsed.urgency || 'medium',
      locationRelevance: parsed.locationRelevance || [],
      sources: queryWithSources.sources.map(s => s.domain),
      urls: queryWithSources.sources.map(s => s.url),
      imageUrl: imageUrl,
      query: queryWithSources.query,
      publishedAt: new Date().toISOString(),
      generatedAt: new Date().toISOString()
    };
    
    console.log(`[Stage 3] ✓ "${article.title.substring(0, 60)}..." (${wordCount}w, ${article.sources.length}src, img:${!!imageUrl})`);
    
    return article;
    
  } catch (error) {
    console.error(`[Stage 3] Error:`, error);
    return null;
  }
}

export async function synthesizeAllPendingArticles(limit: number = 10): Promise<number> {
  console.log(`[Stage 3] Fetching up to ${limit} queries with sources...`);
  
  const snapshot = await firestore
    .collection('pulse_queries_with_sources')
    .where('synthesized', '==', false)
    .limit(limit)
    .get();
  
  if (snapshot.empty) {
    console.log('[Stage 3] No pending queries');
    return 0;
  }
  
  console.log(`[Stage 3] Processing ${snapshot.size} queries in PARALLEL...`);
  
  // Process ALL in parallel for speed
  const results = await Promise.allSettled(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const queryWithSources: QueryWithSources = {
        query: data.query,
        category: data.category,
        priority: data.priority,
        sources: data.sources,
        collectedAt: data.collectedAt
      };
      
      const article = await synthesizeArticle(queryWithSources);
      
      if (article) {
        const articleId = sha1(article.title).slice(0, 20);
        
        await firestore.collection('pulse_articles').doc(articleId).set({
          title: article.title,
          introduction: article.introduction,
          sections: article.sections,
          category: article.category,
          tags: article.tags,
          urgency: article.urgency,
          locationRelevance: article.locationRelevance,
          sources: article.sources,
          urls: article.urls,
          source: article.sources[0] || 'AI Generated',
          url: article.urls[0] || '#',
          imageUrl: article.imageUrl,
          query: article.query,
          publishedAt: article.publishedAt,
          generatedAt: article.generatedAt,
          clusterId: sha1(article.title).slice(0, 12)
        });
        
        await doc.ref.update({ synthesized: true, synthesizedAt: new Date().toISOString() });
        
        return { success: true, title: article.title };
      }
      return { success: false };
    })
  );
  
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failCount = results.length - successCount;
  
  console.log(`[Stage 3] ✓ Complete: ${successCount} articles, ${failCount} failed`);
  
  return successCount;
}
