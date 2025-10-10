# Ojas Pulse: Health News Discovery Feed
## Comprehensive Implementation Plan

> **Status**: Planning Phase  
> **Last Updated**: January 2025  
> **Feature Owner**: Ojas AI Team

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Research Findings](#research-findings)
3. [System Architecture](#system-architecture)
4. [Technology Stack](#technology-stack)
5. [Implementation Phases](#implementation-phases)
6. [Technical Specifications](#technical-specifications)
7. [Cost Optimization](#cost-optimization)
8. [Testing Strategy](#testing-strategy)
9. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Vision
Ojas Pulse is a real-time, personalized health news discovery feed that delivers trusted, relevant health information to users based on their location, health profile, and interests. Similar to Perplexity's "Discover" feature but exclusively focused on health topics.

### Goals
- **Accuracy**: Source only from trusted health authorities (WHO, CDC, ICMR, peer-reviewed journals)
- **Personalization**: Tailor content based on user profile (age, conditions, location, interests)
- **Real-time**: Fresh content updated every 5-15 minutes
- **Performance**: Instant loading with infinite scroll, <100ms response time
- **Engagement**: Concise summaries (3-7 sentences) with citations and "discover more" links

### Key Metrics
- **Content Freshness**: <15 min latency from source publication
- **Deduplication Rate**: >90% similar articles merged
- **Personalization Accuracy**: >70% user engagement with recommended articles
- **Load Performance**: <100ms feed load time from cache

---

## Research Findings

### 1. News Aggregation Best Practices

#### Content Deduplication (Source: NewsCatcher API Research)
**Technique**: Hybrid semantic + string similarity approach

**Semantic Similarity**:
- Convert articles to vector embeddings using NLP models
- Use cosine similarity to compare embeddings
- Threshold: **0.95** for duplicate detection
- Groups similar stories from different sources

**Levenshtein Distance Analysis**:
- Title similarity threshold: **0.97**
- Content similarity threshold: **0.92**
- Prevents near-duplicate articles

**Original Article Identification**:
Rank by:
1. Domain credibility (WHO > CDC > News outlets)
2. Author reputation
3. Publication timestamp (earliest = original)

#### Content Clustering (Source: NewsCatcher API Research)
**Process**:
1. Generate embeddings for all articles
2. Calculate cosine similarity between articles
3. Cluster articles with similarity > threshold
4. Assign unique cluster IDs
5. Select primary article per cluster

**Benefits**:
- Reveals connections between articles
- Tracks story evolution across sources
- Simplifies trend analysis

### 2. Infinite Scroll Best Practices (Source: Nielsen Norman Group)

**Recommended Approach**: **Infinite Scroll + Load More Button**

**Why**:
- ✅ Reduces interruptions (seamless scrolling)
- ✅ Allows footer access (button stops auto-load)
- ✅ Better for mobile (touch-friendly)
- ✅ Reduces bandwidth usage (user controls loading)
- ✅ Prevents "illusion of completeness"

**Implementation**:
- Load initial batch: **20 articles**
- Auto-load next: **10 articles** when user nears bottom
- Show "Load More" button after 50 articles
- Display page indicators for navigation

### 3. Personalization Algorithm

**Multi-Signal Approach**:
1. **Explicit Signals** (User Profile):
   - Age group
   - Chronic conditions
   - Health interests (fitness, mental health, nutrition, etc.)
   - Location (city/state/country)

2. **Implicit Signals** (Behavior):
   - Click-through rate per tag
   - Time spent on articles
   - Search history patterns
   - Conversation topics in chat

3. **Contextual Signals**:
   - Local health alerts (AQI, outbreaks)
   - Trending topics globally/locally
   - Seasonal relevance (flu season, summer health, etc.)

**Scoring Formula**:
```
relevance_score = (
    0.4 × profile_match_score +  // Matches user's conditions/interests
    0.3 × location_score +        // Local relevance
    0.2 × engagement_score +      // Past behavior patterns
    0.1 × recency_score           // Freshness boost
)
```

### 4. Google Cloud Architecture Patterns

#### Event-Driven with Pub/Sub (Source: Google Cloud Solutions)
**Pattern**: Decoupled, scalable, event-driven pipeline

**Components**:
```
Cloud Scheduler → Pub/Sub Topic → Cloud Functions
                     ↓
              [fetch-news-fn]
                     ↓
              Pub/Sub Topic → [process-news-fn]
                     ↓
              Firestore → Frontend
```

**Benefits**:
- **Scalability**: Auto-scales with load
- **Reliability**: Built-in retries, dead-letter queues
- **Cost-effective**: Pay only for execution time
- **Maintainable**: Modular functions, easy debugging

### 5. Vertex AI Embeddings for Similarity

**Model**: `text-embedding-004` (latest, as of Jan 2025)
- **Dimensions**: 768 (configurable: 256, 512, 768)
- **Task Type**: `CLUSTERING` for grouping similar articles
- **Context**: 2048 tokens per article (title + summary + first paragraph)

**Process**:
1. Extract article text (title + summary + content snippet)
2. Truncate to 2048 tokens
3. Call Vertex AI embeddings API with task=CLUSTERING
4. Store embeddings in Firestore for comparison
5. Use cosine similarity to find similar articles

**Cost**: $0.00002 per 1,000 characters (~$0.02 per 1,000 articles)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OJAS PULSE SYSTEM                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Cloud Scheduler │ (Trigger every 5 min)
└────────┬─────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────┐
│                  PUB/SUB: news-fetch-trigger               │
└────────┬───────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────┐
│  CLOUD FUNCTION: fetch-health-news                       │
│  • Query Google Custom Search API                       │
│  • Fetch RSS feeds (WHO, CDC, ICMR, journals)           │
│  • Extract article metadata                             │
│  • Publish to process-queue                             │
└────────┬─────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────┐
│              PUB/SUB: news-process-queue                   │
└────────┬───────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────┐
│  CLOUD FUNCTION: process-and-deduplicate                 │
│  • Generate Vertex AI embeddings                        │
│  • Check similarity with existing articles              │
│  • Merge duplicates, identify clusters                  │
│  • Publish to summarize-queue                           │
└────────┬─────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────┐
│            PUB/SUB: news-summarize-queue                   │
└────────┬───────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────┐
│  CLOUD FUNCTION: summarize-and-tag                       │
│  • Summarize with Gemini 2.5 Flash (3-7 sentences)      │
│  • Extract tags (mental health, fitness, etc.)          │
│  • Assign location relevance                            │
│  • Store in Firestore                                   │
└────────┬─────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────┐
│                     FIRESTORE                            │
│  Collections:                                            │
│  • pulse_articles: Final processed articles             │
│  • pulse_embeddings: Vector embeddings for similarity   │
│  • pulse_clusters: Clustered story groups               │
│  • user_feed_cache: Personalized feed cache             │
└────────┬─────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────┐
│            FRONTEND: React + Infinite Scroll             │
│  • Query Firestore for latest articles                  │
│  • Filter by user preferences                           │
│  • Infinite scroll with Load More button                │
│  • Real-time updates via Firestore listeners            │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. FETCH (every 5 min)
   Google Custom Search → RSS Feeds → Raw Articles

2. DEDUPLICATE
   Raw Articles → Vertex AI Embeddings → Similarity Check → Unique Articles

3. CLUSTER
   Unique Articles → Cosine Similarity → Story Clusters → Primary Article per Cluster

4. SUMMARIZE
   Primary Articles → Gemini 2.5 Flash → 3-7 sentence summary + tags

5. PERSONALIZE
   User Profile → Filter by location + tags → Ranked Feed

6. SERVE
   Firestore Query → Frontend Cache → User sees feed
```

---

## Technology Stack

### Google Cloud Services
| Service | Purpose | Pricing |
|---------|---------|---------|
| **Cloud Scheduler** | Trigger fetch jobs every 5 min | $0.10/job/month |
| **Pub/Sub** | Event-driven messaging | $0.06 per GB + $0.40 per million messages |
| **Cloud Functions** | Serverless processing (fetch, process, summarize) | $0.40 per million invocations |
| **Firestore** | Real-time NoSQL database | $0.18 per GB stored + $0.02 per 100K reads |
| **Vertex AI Embeddings** | Text embeddings for similarity | $0.00002 per 1K characters |
| **Vertex AI Gemini 2.5 Flash** | Article summarization | $0.075 per 1M input tokens |

### Frontend Stack
- **React 18**: UI framework
- **React Query**: Data fetching and caching
- **Firestore SDK**: Real-time data sync
- **Intersection Observer API**: Infinite scroll detection
- **Tailwind CSS**: Styling

### Development Tools
- **Google Cloud CLI**: Infrastructure management
- **Firebase Admin SDK**: Backend Firestore access
- **TypeScript**: Type-safe code
- **Vitest**: Testing framework

---

## Implementation Phases

### Phase 1: Google Cloud Infrastructure Setup (Week 1)

#### 1.1 Enable Required APIs
```bash
gcloud services enable \
  cloudscheduler.googleapis.com \
  pubsub.googleapis.com \
  cloudfunctions.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  customsearch.googleapis.com
```

#### 1.2 Create Pub/Sub Topics
```bash
# Fetch trigger topic
gcloud pubsub topics create news-fetch-trigger

# Processing queue
gcloud pubsub topics create news-process-queue

# Summarization queue
gcloud pubsub topics create news-summarize-queue

# Dead letter queue for failed messages
gcloud pubsub topics create news-dead-letter
```

#### 1.3 Create Firestore Collections
Collections to create in Firestore console:
- `pulse_articles`: Processed, ready-to-serve articles
- `pulse_embeddings`: Cached article embeddings
- `pulse_clusters`: Story cluster metadata
- `pulse_raw`: Temporary raw articles (TTL: 7 days)
- `user_feed_cache`: User-specific feed cache (TTL: 1 hour)

#### 1.4 Set up Cloud Scheduler
```bash
gcloud scheduler jobs create pubsub fetch-news-job \
  --schedule="*/5 * * * *" \
  --topic=news-fetch-trigger \
  --message-body='{"source":"scheduler"}' \
  --location=us-central1
```

#### 1.5 Configure Service Accounts
Create service account with permissions:
- Pub/Sub Publisher/Subscriber
- Firestore Editor
- Cloud Functions Invoker
- Vertex AI User

**Estimated Time**: 1-2 days  
**Output**: Fully configured Google Cloud infrastructure

---

### Phase 2: Data Fetch Layer (Week 2)

#### 2.1 Health News Sources

**Google Custom Search API Configuration**:
```javascript
// Trusted health domains to prioritize
const TRUSTED_DOMAINS = [
  'who.int',           // World Health Organization
  'cdc.gov',           // Centers for Disease Control
  'nih.gov',           // National Institutes of Health
  'icmr.gov.in',       // Indian Council of Medical Research
  'mohfw.gov.in',      // Ministry of Health & Family Welfare (India)
  'thelancet.com',     // The Lancet (peer-reviewed)
  'nejm.org',          // New England Journal of Medicine
  'bmj.com',           // British Medical Journal
  'mayoclinic.org',    // Mayo Clinic
  'healthline.com',    // Healthline (consumer health)
  'webmd.com'          // WebMD (consumer health)
];

// Search queries for different health categories
const SEARCH_QUERIES = {
  general: 'health news OR medical news OR healthcare',
  mental: 'mental health OR depression OR anxiety OR wellness',
  fitness: 'fitness OR exercise OR physical activity OR workout',
  nutrition: 'nutrition OR diet OR healthy eating',
  chronic: 'diabetes OR heart disease OR cancer OR chronic illness',
  environment: 'air quality OR environmental health OR climate health',
  pandemic: 'outbreak OR epidemic OR infectious disease',
  medication: 'medication OR drug OR pharmaceutical OR treatment'
};
```

**RSS Feeds to Monitor**:
```javascript
const RSS_FEEDS = [
  'https://www.who.int/rss-feeds/news-english.xml',
  'https://tools.cdc.gov/api/v2/resources/media/132608.rss',
  'https://www.nih.gov/news-events/news-releases/rss',
  'https://feeds.medicalnewstoday.com/rss',
  'https://rss.healthline.com/health-news',
  'https://www.thelancet.com/rssfeed/lancet_current.xml'
];
```

#### 2.2 Cloud Function: fetch-health-news

**File**: `functions/fetch-health-news/index.js`

```javascript
const { PubSub } = require('@google-cloud/pubsub');
const axios = require('axios');
const Parser = require('rss-parser');
const { customsearch } = require('googleapis').customsearch('v1');

const pubsub = new PubSub();
const parser = new Parser();

exports.fetchHealthNews = async (message, context) => {
  console.log('Starting news fetch...');
  
  const articles = [];
  
  // 1. Fetch from Google Custom Search
  const searchResults = await fetchFromCustomSearch();
  articles.push(...searchResults);
  
  // 2. Fetch from RSS feeds
  const rssResults = await fetchFromRSS();
  articles.push(...rssResults);
  
  // 3. Publish each article to processing queue
  for (const article of articles) {
    await pubsub
      .topic('news-process-queue')
      .publishMessage({ json: article });
  }
  
  console.log(`Fetched ${articles.length} articles`);
};

async function fetchFromCustomSearch() {
  const results = [];
  
  for (const [category, query] of Object.entries(SEARCH_QUERIES)) {
    const response = await customsearch.cse.list({
      cx: process.env.CUSTOM_SEARCH_ENGINE_ID,
      q: query,
      dateRestrict: 'd1', // Last 24 hours
      siteSearch: TRUSTED_DOMAINS.join(' OR '),
      num: 10,
      auth: process.env.GOOGLE_API_KEY
    });
    
    if (response.data.items) {
      results.push(...response.data.items.map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: new URL(item.link).hostname,
        category,
        publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'] || new Date().toISOString(),
        fetchedAt: new Date().toISOString()
      })));
    }
  }
  
  return results;
}

async function fetchFromRSS() {
  const results = [];
  
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      
      const recentItems = feed.items
        .filter(item => {
          const pubDate = new Date(item.pubDate);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return pubDate > dayAgo;
        })
        .map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.contentSnippet || item.content?.substring(0, 200),
          source: new URL(feedUrl).hostname,
          category: 'general',
          publishedAt: item.pubDate,
          fetchedAt: new Date().toISOString()
        }));
      
      results.push(...recentItems);
    } catch (error) {
      console.error(`Error fetching RSS ${feedUrl}:`, error);
    }
  }
  
  return results;
}
```

**Deploy Command**:
```bash
gcloud functions deploy fetch-health-news \
  --runtime nodejs20 \
  --trigger-topic news-fetch-trigger \
  --region us-central1 \
  --memory 512MB \
  --timeout 300s \
  --set-env-vars CUSTOM_SEARCH_ENGINE_ID=xxx,GOOGLE_API_KEY=xxx
```

**Estimated Time**: 3-4 days  
**Output**: Automated news fetching from trusted sources every 5 minutes

---

### Phase 3: Deduplication & Clustering (Week 3)

#### 3.1 Cloud Function: process-and-deduplicate

**File**: `functions/process-news/index.js`

```javascript
const { Firestore } = require('@google-cloud/firestore');
const { VertexAI } = require('@google-cloud/vertexai');
const { PubSub } = require('@google-cloud/pubsub');

const firestore = new Firestore();
const vertexAI = new VertexAI({ project: process.env.PROJECT_ID, location: 'us-central1' });
const model = vertexAI.getGenerativeModel({ model: 'text-embedding-004' });
const pubsub = new PubSub();

exports.processNews = async (message, context) => {
  const article = message.json;
  
  // 1. Generate embedding for article
  const embedding = await generateEmbedding(article);
  article.embedding = embedding;
  
  // 2. Check for duplicates using cosine similarity
  const duplicateId = await findDuplicate(article, embedding);
  
  if (duplicateId) {
    // Merge with existing article (add as additional source)
    await mergeArticle(duplicateId, article);
    console.log(`Merged duplicate: ${article.title}`);
    return;
  }
  
  // 3. Find similar articles for clustering
  const clusterId = await findOrCreateCluster(article, embedding);
  article.clusterId = clusterId;
  
  // 4. Store in Firestore raw collection
  const docRef = await firestore.collection('pulse_raw').add(article);
  article.id = docRef.id;
  
  // 5. Publish to summarization queue
  await pubsub.topic('news-summarize-queue').publishMessage({ json: article });
  
  console.log(`Processed: ${article.title}`);
};

async function generateEmbedding(article) {
  const text = `${article.title}\n${article.snippet}`;
  
  const request = {
    instances: [{ content: text }],
    parameters: {
      task: 'CLUSTERING',
      outputDimensionality: 768
    }
  };
  
  const [response] = await model.predictEmbeddings(request);
  return response.predictions[0].embeddings.values;
}

async function findDuplicate(article, embedding) {
  // Query recent articles (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const snapshot = await firestore.collection('pulse_embeddings')
    .where('publishedAt', '>=', weekAgo.toISOString())
    .get();
  
  for (const doc of snapshot.docs) {
    const existing = doc.data();
    
    // Calculate cosine similarity
    const similarity = cosineSimilarity(embedding, existing.embedding);
    
    // Threshold: 0.95 (from research)
    if (similarity >= 0.95) {
      // Additional check: Levenshtein distance on title
      const titleSimilarity = levenshteinSimilarity(article.title, existing.title);
      if (titleSimilarity >= 0.97) {
        return doc.id; // Duplicate found
      }
    }
  }
  
  // Store embedding for future comparisons
  await firestore.collection('pulse_embeddings').add({
    articleId: article.url,
    embedding,
    publishedAt: article.publishedAt,
    title: article.title
  });
  
  return null;
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

function levenshteinSimilarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  const distance = levenshteinDistance(longer, shorter);
  return (longerLength - distance) / longerLength;
}

function levenshteinDistance(s1, s2) {
  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[s2.length][s1.length];
}

async function findOrCreateCluster(article, embedding) {
  // Check existing clusters for similar stories
  const clusters = await firestore.collection('pulse_clusters')
    .where('updatedAt', '>=', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .get();
  
  for (const clusterDoc of clusters.docs) {
    const cluster = clusterDoc.data();
    const similarity = cosineSimilarity(embedding, cluster.centroidEmbedding);
    
    if (similarity >= 0.85) {
      // Add to existing cluster
      await firestore.collection('pulse_clusters').doc(clusterDoc.id).update({
        articleCount: cluster.articleCount + 1,
        updatedAt: new Date().toISOString(),
        sources: [...cluster.sources, article.source]
      });
      return clusterDoc.id;
    }
  }
  
  // Create new cluster
  const newCluster = await firestore.collection('pulse_clusters').add({
    centroidEmbedding: embedding,
    primaryTitle: article.title,
    articleCount: 1,
    sources: [article.source],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  return newCluster.id;
}

async function mergeArticle(existingId, newArticle) {
  const docRef = firestore.collection('pulse_raw').doc(existingId);
  const doc = await docRef.get();
  
  if (!doc.exists) return;
  
  const existing = doc.data();
  await docRef.update({
    sources: [...(existing.sources || [existing.source]), newArticle.source],
    urls: [...(existing.urls || [existing.url]), newArticle.url],
    updatedAt: new Date().toISOString()
  });
}
```

**Deploy Command**:
```bash
gcloud functions deploy process-news \
  --runtime nodejs20 \
  --trigger-topic news-process-queue \
  --region us-central1 \
  --memory 1GB \
  --timeout 540s
```

**Estimated Time**: 4-5 days  
**Output**: Deduplicated and clustered articles ready for summarization

---

### Phase 4: AI Summarization & Tagging (Week 4)

#### 4.1 Cloud Function: summarize-and-tag

**File**: `functions/summarize-news/index.js`

```javascript
const { Firestore } = require('@google-cloud/firestore');
const { VertexAI, HarmCategory, HarmBlockThreshold } = require('@google-cloud/vertexai');

const firestore = new Firestore();
const vertexAI = new VertexAI({ project: process.env.PROJECT_ID, location: 'us-central1' });
const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
  ]
});

const SYSTEM_PROMPT = `You are a health news summarizer for Ojas Pulse. 

Your task:
1. Summarize the article in 3-7 clear, concise sentences
2. Focus on key health insights, not marketing fluff
3. Extract relevant tags from this list ONLY: mental-health, fitness, nutrition, chronic-disease, medication, environmental-health, pandemic, preventive-care, women-health, child-health, aging, sleep, stress
4. Determine location relevance (global, regional, or specific country/city)
5. Assess urgency (low, medium, high, critical)

Format your response as JSON:
{
  "summary": "3-7 sentence summary here",
  "tags": ["tag1", "tag2"],
  "locationRelevance": "global" | "regional" | "country:IN" | "city:Mumbai",
  "urgency": "low" | "medium" | "high" | "critical",
  "keyInsights": ["insight 1", "insight 2"]
}`;

exports.summarizeNews = async (message, context) => {
  const article = message.json;
  
  try {
    // 1. Fetch full article content (if needed)
    const fullText = article.fullText || article.snippet;
    
    // 2. Generate summary with Gemini
    const prompt = `Article Title: ${article.title}\n\nContent: ${fullText}\n\nSource: ${article.source}\n\nProvide a JSON summary.`;
    
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'user', parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024
      }
    });
    
    const response = result.response.text();
    const summaryData = JSON.parse(response);
    
    // 3. Store in pulse_articles (final collection)
    await firestore.collection('pulse_articles').add({
      title: article.title,
      summary: summaryData.summary,
      tags: summaryData.tags,
      locationRelevance: summaryData.locationRelevance,
      urgency: summaryData.urgency,
      keyInsights: summaryData.keyInsights || [],
      source: article.source,
      sources: article.sources || [article.source],
      url: article.url,
      urls: article.urls || [article.url],
      clusterId: article.clusterId,
      category: article.category,
      publishedAt: article.publishedAt,
      processedAt: new Date().toISOString(),
      imageUrl: article.imageUrl || null
    });
    
    console.log(`Summarized: ${article.title}`);
    
  } catch (error) {
    console.error('Summarization error:', error);
    // Store in dead-letter for manual review
    await pubsub.topic('news-dead-letter').publishMessage({ json: { article, error: error.message } });
  }
};
```

**Deploy Command**:
```bash
gcloud functions deploy summarize-news \
  --runtime nodejs20 \
  --trigger-topic news-summarize-queue \
  --region us-central1 \
  --memory 512MB \
  --timeout 120s
```

**Estimated Time**: 3-4 days  
**Output**: AI-summarized articles with tags and metadata stored in Firestore

---

### Phase 5: Frontend Pulse Feed UI (Week 5)

#### 5.1 Create Pulse Page Component

**File**: `src/pages/Pulse.tsx`

```typescript
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, orderBy, limit, startAfter, where, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import PulseCard from '@/components/Pulse/PulseCard';
import PulseFilters from '@/components/Pulse/PulseFilters';
import { profileStore } from '@/lib/profileStore';

interface PulseArticle {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  source: string;
  sources?: string[];
  url: string;
  urls?: string[];
  publishedAt: string;
  locationRelevance: string;
  urgency: string;
  keyInsights: string[];
  imageUrl?: string;
}

const ARTICLES_PER_PAGE = 20;

const Pulse = () => {
  const [articles, setArticles] = useState<PulseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch initial articles
  useEffect(() => {
    fetchArticles(true);
  }, [selectedTags]);

  const fetchArticles = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setArticles([]);
      setLastDoc(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const articlesRef = collection(db, 'pulse_articles');
      let q = query(
        articlesRef,
        orderBy('publishedAt', 'desc'),
        limit(ARTICLES_PER_PAGE)
      );

      // Filter by selected tags
      if (selectedTags.length > 0) {
        q = query(q, where('tags', 'array-contains-any', selectedTags));
      }

      // Pagination
      if (lastDoc && !isInitial) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const newArticles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PulseArticle));

      setArticles(prev => isInitial ? newArticles : [...prev, ...newArticles]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === ARTICLES_PER_PAGE);

    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchArticles(false);
        }
      },
      { threshold: 0.5 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, lastDoc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Ojas Pulse</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trusted health news, personalized for you
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <PulseFilters
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
        />
      </div>

      {/* Articles Feed */}
      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-4">
        {articles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No articles found. Try adjusting your filters.
          </div>
        ) : (
          <>
            {articles.map((article) => (
              <PulseCard key={article.id} article={article} />
            ))}

            {/* Load More Trigger */}
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {loadingMore && (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              )}
              {!hasMore && articles.length > 0 && (
                <p className="text-sm text-muted-foreground">You've reached the end!</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Pulse;
```

#### 5.2 Create PulseCard Component

**File**: `src/components/Pulse/PulseCard.tsx`

```typescript
import React from 'react';
import { ExternalLink, Clock, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface PulseCardProps {
  article: {
    id: string;
    title: string;
    summary: string;
    tags: string[];
    source: string;
    sources?: string[];
    url: string;
    urls?: string[];
    publishedAt: string;
    urgency: string;
    keyInsights: string[];
    imageUrl?: string;
  };
}

const PulseCard: React.FC<PulseCardProps> = ({ article }) => {
  const urgencyColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700'
  };

  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      {/* Urgency Badge */}
      {article.urgency !== 'low' && (
        <Badge className={`mb-3 ${urgencyColors[article.urgency]}`}>
          <TrendingUp className="h-3 w-3 mr-1" />
          {article.urgency.toUpperCase()}
        </Badge>
      )}

      {/* Title */}
      <h2 className="text-xl font-semibold mb-3 leading-tight">
        {article.title}
      </h2>

      {/* Summary */}
      <p className="text-muted-foreground mb-4 leading-relaxed">
        {article.summary}
      </p>

      {/* Key Insights */}
      {article.keyInsights && article.keyInsights.length > 0 && (
        <div className="mb-4 p-3 bg-primary/5 rounded-md border-l-2 border-primary">
          <p className="text-sm font-medium mb-1">Key Insights:</p>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            {article.keyInsights.slice(0, 2).map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {article.tags.map(tag => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag.replace(/-/g, ' ')}
          </Badge>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{timeAgo}</span>
          </div>
          <span>•</span>
          <span>
            {article.sources?.length > 1
              ? `${article.sources.length} sources`
              : article.source}
          </span>
        </div>

        {/* Discover More Link */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline font-medium"
        >
          Discover more
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Multiple Sources */}
      {article.sources && article.sources.length > 1 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">Also covered by:</p>
          <div className="flex flex-wrap gap-2">
            {article.sources.slice(1, 4).map((source, i) => (
              <a
                key={i}
                href={article.urls?.[i + 1] || article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {source}
              </a>
            ))}
            {article.sources.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{article.sources.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default PulseCard;
```

#### 5.3 Add Pulse to Sidebar

**File**: `src/components/Layout/AppShell.tsx` (modification)

Add Pulse icon button in the sidebar similar to Home button:

```typescript
// Add import
import { Activity } from 'lucide-react';

// Add button after Home button
<button
  onClick={() => navigate('/pulse')}
  className={cn(
    "w-10 h-10 rounded-lg flex items-center justify-center mb-0 transition-colors",
    location.pathname === '/pulse' ? "bg-gray-200 text-gray-900" : "hover:bg-gray-100"
  )}
  aria-label="Pulse Feed"
>
  <Activity className="h-5 w-5 text-gray-600" />
</button>
<span className="text-[10px] text-gray-500 mt-0 mb-1 leading-tight">Pulse</span>
```

#### 5.4 Add Pulse Route

**File**: `src/App.tsx` (add route)

```typescript
import Pulse from "@/pages/Pulse";

// Add route
<Route path="/pulse" element={<Pulse />} />
```

**Estimated Time**: 5-6 days  
**Output**: Functional Pulse feed UI with infinite scroll

---

### Phase 6: Personalization & Filtering (Week 6)

#### 6.1 User Profile-Based Filtering

**File**: `src/lib/pulsePersonalization.ts`

```typescript
import { profileStore, type UserProfile } from './profileStore';

export interface PersonalizationScore {
  articleId: string;
  score: number;
  breakdown: {
    profileMatch: number;
    locationMatch: number;
    engagementScore: number;
    recencyScore: number;
  };
}

/**
 * Calculate relevance score for an article based on user profile
 */
export function calculateRelevanceScore(
  article: any,
  userProfile: UserProfile,
  userLocation: string,
  clickHistory: string[] = []
): PersonalizationScore {
  const weights = {
    profileMatch: 0.4,
    locationMatch: 0.3,
    engagement: 0.2,
    recency: 0.1
  };

  // 1. Profile Match Score
  let profileScore = 0;
  if (userProfile.healthConditions) {
    const conditions = userProfile.healthConditions.toLowerCase();
    const articleTags = article.tags.join(' ').toLowerCase();
    
    // Check if article tags match user's conditions
    if (conditions.includes('diabetes') && articleTags.includes('chronic-disease')) profileScore += 0.3;
    if (conditions.includes('heart') && articleTags.includes('chronic-disease')) profileScore += 0.3;
    if (conditions.includes('mental') && articleTags.includes('mental-health')) profileScore += 0.4;
  }
  
  // Age-based relevance
  if (userProfile.age) {
    const age = parseInt(userProfile.age);
    if (age > 60 && article.tags.includes('aging')) profileScore += 0.2;
    if (age < 18 && article.tags.includes('child-health')) profileScore += 0.2;
  }

  // 2. Location Match Score
  let locationScore = 0;
  if (article.locationRelevance === 'global') {
    locationScore = 0.5; // Global news is moderately relevant
  } else if (article.locationRelevance.startsWith('country:') && userLocation) {
    const articleCountry = article.locationRelevance.split(':')[1];
    if (userLocation.includes(articleCountry)) {
      locationScore = 1.0; // Perfect match
    }
  } else if (article.locationRelevance.startsWith('city:') && userLocation) {
    const articleCity = article.locationRelevance.split(':')[1];
    if (userLocation.includes(articleCity)) {
      locationScore = 1.0; // Perfect match
    }
  }

  // 3. Engagement Score (based on past clicks)
  let engagementScore = 0;
  const clickedTags = clickHistory.flatMap(id => article.tags || []);
  const matchingTags = article.tags.filter(tag => clickedTags.includes(tag));
  engagementScore = matchingTags.length / Math.max(article.tags.length, 1);

  // 4. Recency Score
  const ageInHours = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 1 - (ageInHours / 72)); // Decay over 72 hours

  // Final weighted score
  const finalScore =
    weights.profileMatch * profileScore +
    weights.locationMatch * locationScore +
    weights.engagement * engagementScore +
    weights.recency * recencyScore;

  return {
    articleId: article.id,
    score: finalScore,
    breakdown: {
      profileMatch: profileScore,
      locationMatch: locationScore,
      engagementScore,
      recencyScore
    }
  };
}

/**
 * Rank articles by personalization score
 */
export function rankArticles(
  articles: any[],
  userProfile: UserProfile,
  userLocation: string,
  clickHistory: string[] = []
): any[] {
  const scoredArticles = articles.map(article => ({
    ...article,
    _score: calculateRelevanceScore(article, userProfile, userLocation, clickHistory).score
  }));

  return scoredArticles.sort((a, b) => b._score - a._score);
}
```

**Estimated Time**: 3-4 days  
**Output**: Personalized feed ranking based on user profile

---

### Phase 7: Testing & Optimization (Week 7)

#### 7.1 Testing Plan

**Unit Tests**:
- Cosine similarity calculation
- Levenshtein distance
- Deduplication logic
- Personalization scoring

**Integration Tests**:
- End-to-end article pipeline (fetch → dedupe → summarize → store)
- Firestore query performance
- Pub/Sub message flow

**Performance Tests**:
- Feed load time (<100ms target)
- Infinite scroll smoothness
- Cloud Function execution time

#### 7.2 Monitoring & Alerts

**Cloud Monitoring Metrics**:
- Function execution count
- Error rate
- Latency (p50, p95, p99)
- Firestore read/write counts
- Pub/Sub message backlog

**Alerts to Configure**:
- Error rate > 5%
- Latency p95 > 1s
- Pub/Sub backlog > 100 messages
- Daily cost > $10

**Estimated Time**: 4-5 days  
**Output**: Production-ready, monitored system

---

## Cost Optimization Strategies

### 1. Reduce API Calls
- **Cache embeddings** for 7 days (avoid re-computing for same articles)
- **Batch summarization** (process 10 articles at once instead of one-by-one)
- **Smart deduplication** (compare only with articles from last 7 days, not entire history)

### 2. Optimize Firestore Usage
- **Use TTL** for temporary collections (pulse_raw: 7 days, user_feed_cache: 1 hour)
- **Composite indexes** for common queries (publishedAt + tags)
- **Limit reads** with pagination (20 articles at a time)

### 3. Cloud Function Optimization
- **Use smaller memory** (256MB when possible, 1GB only for embeddings)
- **Cold start reduction** (keep functions warm with scheduled pings)
- **Timeout tuning** (shorter timeouts prevent runaway costs)

### 4. Cost Monitoring
**Estimated Monthly Costs** (for 500 articles/day):
```
Cloud Scheduler:     $0.10/month
Pub/Sub:             $2/month
Cloud Functions:     $10-15/month
Firestore:           $5-10/month
Vertex AI:           $8-12/month
------------------------
TOTAL:               ~$25-40/month
```

---

## Future Enhancements

### Phase 8+: Advanced Features

1. **Multilingual Summaries** (via Azure Translation API)
   - Translate summaries to user's preferred language
   - Support 50+ languages

2. **Environmental Health Alerts**
   - Integrate Google Air Quality API
   - Show AQI alerts based on user location
   - Weather-related health warnings

3. **Trending Topics Widget**
   - Show most-discussed health topics today
   - Trending hashtags/keywords

4. **Personalized Newsletters**
   - Daily/weekly email digest
   - Custom topic selection

5. **Voice Summaries**
   - Text-to-speech integration
   - Listen to articles hands-free

6. **Bookmark & Save**
   - User collections
   - Share with friends

7. **Advanced Analytics**
   - User engagement metrics
   - A/B testing for personalization

---

## Next Steps

### Immediate Actions (Week 1)
1. ✅ Complete this comprehensive plan document
2. 📋 Create Google Cloud project and enable APIs
3. 📋 Set up Firestore database
4. 📋 Configure Pub/Sub topics
5. 📋 Deploy first Cloud Function (fetch-news)

### Questions to Answer Before Implementation
1. **Budget Approval**: Confirm $25-40/month budget for Phase 1
2. **API Keys**: Obtain Google Custom Search API key and CSE ID
3. **Data Retention**: Confirm 7-day retention for raw articles
4. **Multilingual**: Start with English-only or include Indian languages from day 1?
5. **Location Detection**: Use IP-based geolocation or ask user during onboarding?

---

## References & Research Sources

### News Aggregation
- NewsCatcher API Documentation (clustering & deduplication)
- Perplexity Discover Feature (Reddit discussions)

### Architecture
- Google Cloud Solutions: Event-Driven Architecture with Pub/Sub
- Firestore Best Practices for Real-Time Feeds

### UI/UX
- Nielsen Norman Group: Infinite Scrolling Guidelines
- Facebook/Instagram Feed Architecture

### AI/ML
- Vertex AI Text Embeddings Documentation
- Gemini 2.5 Flash Summarization Best Practices

---

**Document Status**: ✅ Ready for Review  
**Last Updated**: January 8, 2025  
**Next Review**: After Phase 1 Completion

