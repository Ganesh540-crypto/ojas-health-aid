# Vector Embeddings Implementation Plan

## ✅ Phase 1: Profile Summary Section (COMPLETED)

**Added to `memoryEnhanced.ts`:**
- ✅ `profileSummary` section in CoreMemoryBlock
- ✅ AI can update summaries via `updateProfileSummary()` function
- ✅ Automatically included in context building

**Use Case:**
```typescript
// AI learns: "I'm 32, software engineer, have diabetes"
// AI calls:
updateProfileSummary({
  personalDetails: "32-year-old software engineer from Hyderabad",
  healthSummary: "Type 2 diabetes, takes metformin 500mg daily",
  communicationStyle: "Prefers detailed technical explanations"
});

// Later in new chat:
// User: "Do you remember me?"
// AI: "Yes! You're a 32-year-old software engineer managing Type 2 diabetes..."
```

---

## 🚀 Phase 2: Firebase Vector Embeddings Setup

### What We'll Build

```
┌──────────────────────────────────────────────────┐
│  USER SENDS MESSAGE                              │
└──────────────┬───────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────┐
│  1. Generate Embedding with Gemini API           │
│     → Text: "my blood sugar was 150"             │
│     → Vector: [0.23, -0.15, 0.67, ... 768 dims]  │
└──────────────┬───────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────┐
│  2. Store in Firebase Firestore                  │
│     users/{userId}/memories/{messageId}          │
│     - content: "my blood sugar was 150"          │
│     - embedding: Vector[768]                     │
│     - timestamp: 1234567890                      │
│     - type: "health_data"                        │
└──────────────┬───────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────┐
│  3. When User Asks: "What was my sugar level?"  │
│     → Generate query embedding                   │
│     → Search similar vectors in Firestore        │
│     → Return: "Your blood sugar was 150"         │
└──────────────────────────────────────────────────┘
```

### Benefits

| Feature | Without Vectors | With Vectors |
|---------|----------------|--------------|
| **Search** | Exact keywords only | Semantic understanding |
| **Example** | Search "diabetes" | Finds "blood sugar", "glucose", "A1C" |
| **Recall** | Must remember exact words | AI finds similar meanings |
| **Speed** | O(n) linear scan | O(log n) indexed search |
| **Storage** | Firebase + LocalStorage | Centralized Firebase |
| **Cross-device** | ❌ Local only | ✅ Syncs everywhere |

---

## 📋 Implementation Steps

### **Step 1: Install Firebase Dependencies** (5 mins)

```bash
# Already have firebase, just ensure it's latest
npm install firebase@latest
```

### **Step 2: Create Embedding Service** (15 mins)

Create `src/lib/embeddingService.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

class EmbeddingService {
  private ai: GoogleGenAI;
  private model = 'gemini-embedding-001';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  /**
   * Generate embedding for text
   * Returns 768-dimensional vector
   */
  async generateEmbedding(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
    try {
      const result = await this.ai.models.embedContent(
        this.model,
        {
          content: { parts: [{ text }] },
          taskType,
        }
      );

      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient for bulk operations
   */
  async generateBatchEmbeddings(
    texts: string[],
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
  ): Promise<number[][]> {
    try {
      const contents = texts.map(text => ({ parts: [{ text }] }));
      
      const result = await this.ai.models.batchEmbedContents(
        this.model,
        {
          requests: contents.map(content => ({ content, taskType }))
        }
      );

      return result.embeddings.map(e => e.values);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns value between -1 and 1 (higher = more similar)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}

export const embeddingService = new EmbeddingService();
```

### **Step 3: Create Vector Memory Service** (30 mins)

Create `src/lib/vectorMemory.ts`:

```typescript
import { getFirestore, collection, addDoc, query, where, orderBy, limit as firestoreLimit, getDocs, FieldValue } from 'firebase/firestore';
import { auth } from './firebase';
import { embeddingService } from './embeddingService';

interface VectorMemoryItem {
  id?: string;
  userId: string;
  content: string;
  embedding: number[]; // 768-dimensional vector
  type: 'health_data' | 'conversation' | 'user_preference' | 'fact';
  chatId?: string;
  messageId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

class VectorMemoryService {
  private db = getFirestore();
  private collectionName = 'vector_memories';

  /**
   * Store a memory with its vector embedding
   */
  async storeMemory(
    content: string,
    type: VectorMemoryItem['type'],
    metadata?: { chatId?: string; messageId?: string; [key: string]: any }
  ): Promise<string> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      // Generate embedding
      const embedding = await embeddingService.generateEmbedding(content, 'RETRIEVAL_DOCUMENT');

      // Store in Firestore
      const docRef = await addDoc(collection(this.db, this.collectionName), {
        userId,
        content,
        embedding: FieldValue.vector(embedding), // Firestore vector type
        type,
        chatId: metadata?.chatId,
        messageId: metadata?.messageId,
        timestamp: Date.now(),
        metadata: metadata || {}
      });

      return docRef.id;
    } catch (error) {
      console.error('Error storing vector memory:', error);
      throw error;
    }
  }

  /**
   * Search memories using semantic similarity
   */
  async searchMemories(
    query: string,
    options: {
      type?: VectorMemoryItem['type'];
      limit?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<Array<VectorMemoryItem & { similarity: number }>> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const { type, limit = 5, similarityThreshold = 0.7 } = options;

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query, 'RETRIEVAL_QUERY');

      // Build Firestore query
      let q = query(
        collection(this.db, this.collectionName),
        where('userId', '==', userId)
      );

      if (type) {
        q = query(q, where('type', '==', type));
      }

      // Perform vector similarity search
      // Note: Requires vector index to be created
      const vectorQuery = query(
        q,
        orderBy('embedding'),
        firestoreLimit(limit * 2) // Get more to filter by similarity
      );

      const snapshot = await getDocs(vectorQuery);
      const results: Array<VectorMemoryItem & { similarity: number }> = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const similarity = embeddingService.cosineSimilarity(
          queryEmbedding,
          data.embedding
        );

        if (similarity >= similarityThreshold) {
          results.push({
            id: doc.id,
            userId: data.userId,
            content: data.content,
            embedding: data.embedding,
            type: data.type,
            chatId: data.chatId,
            messageId: data.messageId,
            timestamp: data.timestamp,
            metadata: data.metadata,
            similarity
          });
        }
      });

      // Sort by similarity
      results.sort((a, b) => b.similarity - a.similarity);

      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching vector memories:', error);
      throw error;
    }
  }

  /**
   * Get recent memories of a specific type
   */
  async getRecentMemories(
    type: VectorMemoryItem['type'],
    limit = 10
  ): Promise<VectorMemoryItem[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const q = query(
        collection(this.db, this.collectionName),
        where('userId', '==', userId),
        where('type', '==', type),
        orderBy('timestamp', 'desc'),
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(q);
      const results: VectorMemoryItem[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        results.push({
          id: doc.id,
          userId: data.userId,
          content: data.content,
          embedding: data.embedding,
          type: data.type,
          chatId: data.chatId,
          messageId: data.messageId,
          timestamp: data.timestamp,
          metadata: data.metadata
        });
      });

      return results;
    } catch (error) {
      console.error('Error getting recent memories:', error);
      throw error;
    }
  }

  /**
   * Search for similar health data
   * Useful for "Do you remember when I..." queries
   */
  async findSimilarHealthData(query: string, limit = 5): Promise<VectorMemoryItem[]> {
    const results = await this.searchMemories(query, {
      type: 'health_data',
      limit,
      similarityThreshold: 0.75
    });

    return results;
  }
}

export const vectorMemory = new VectorMemoryService();
```

### **Step 4: Create Firebase Vector Index** (10 mins)

Create `firestore.indexes.json` (if not exists) or add to existing:

```json
{
  "indexes": [],
  "fieldOverrides": [
    {
      "collectionGroup": "vector_memories",
      "fieldPath": "embedding",
      "indexes": [
        {
          "order": "ASCENDING",
          "queryScope": "COLLECTION"
        }
      ],
      "vectorConfig": {
        "dimension": 768,
        "flat": {}
      }
    }
  ]
}
```

Deploy index:
```bash
firebase deploy --only firestore:indexes
```

### **Step 5: Integrate with Enhanced Memory** (20 mins)

Update `memoryEnhanced.ts` to use vector storage:

```typescript
// Add to EnhancedMemoryStore class

async addToArchivalMemoryWithVector(
  content: string,
  type: ArchivalMemoryItem['type'],
  metadata: Record<string, any> = {}
) {
  // Store locally
  this.addToArchivalMemory(content, type, metadata);
  
  // Store in Firebase with vector embedding
  try {
    const { vectorMemory } = await import('./vectorMemory');
    await vectorMemory.storeMemory(content, type, metadata);
  } catch (error) {
    console.error('Failed to store vector memory:', error);
  }
}

async searchWithVectors(query: string, limit = 5): Promise<string[]> {
  try {
    const { vectorMemory } = await import('./vectorMemory');
    const results = await vectorMemory.searchMemories(query, { limit });
    return results.map(r => r.content);
  } catch (error) {
    console.error('Vector search failed, falling back to keyword search:', error);
    return this.searchArchivalMemory(query, limit).map(r => r.content);
  }
}
```

### **Step 6: Add Memory Functions for Vector Search** (10 mins)

Update `memoryFunctions.ts`:

```typescript
export const memoryManagementFunctions = {
  // ... existing functions ...

  searchSemanticMemory: {
    name: 'searchSemanticMemory',
    description: 'Search through memories using semantic understanding (meaning-based, not just keywords). Use when user asks "Do you remember..." or mentions past conversations.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for (can be natural language)'
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 5)',
          default: 5
        }
      },
      required: ['query']
    }
  }
};

// In executeMemoryFunction:
case 'searchSemanticMemory': {
  const { query, limit = 5 } = args;
  const results = await enhancedMemoryStore.searchWithVectors(query, limit);
  return {
    success: true,
    message: `Found ${results.length} relevant memories`,
    data: results
  };
}
```

### **Step 7: Update AI Router** (15 mins)

In `aiRouter.ts`, enable memory functions:

```typescript
// When calling Gemini
const model = this.ai.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{
    functionDeclarations: Object.values(memoryManagementFunctions)
  }]
});

// Handle function calls
if (response.functionCall) {
  const { name, args } = response.functionCall;
  const result = await executeMemoryFunction(name, args);
  
  // Send result back to model for final response
  const functionResponse = {
    functionResponse: {
      name,
      response: result
    }
  };
  
  // Continue conversation with function result
  // ... (implementation details)
}
```

---

## 🧪 Testing Plan

### Test 1: Basic Storage
```typescript
// Store health data
await vectorMemory.storeMemory(
  "My blood sugar was 150 mg/dL this morning",
  "health_data"
);

// Expected: Successfully stored with embedding
```

### Test 2: Semantic Search
```typescript
// Search with different wording
const results = await vectorMemory.searchMemories(
  "What was my glucose level?"
);

// Expected: Returns "My blood sugar was 150 mg/dL"
// Even though query used "glucose" and memory said "blood sugar"
```

### Test 3: AI Integration
```
User: "I have diabetes and take metformin 500mg twice daily"
AI: [Calls updateProfileSummary + storeMemory]

[New chat, next day]
User: "Do you remember what medication I take?"
AI: [Calls searchSemanticMemory("medication")]
AI: "Yes! You take metformin 500mg twice daily for your diabetes."
```

---

## 📊 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Embedding Generation** | <200ms | Time to generate vector |
| **Storage** | <300ms | Time to store in Firebase |
| **Search** | <500ms | Time to find similar memories |
| **Accuracy** | >85% | Relevant results returned |

---

## 💰 Cost Estimation

### Gemini Embeddings API
- **Free tier**: 1,500 requests/day
- **Paid**: $0.00001 per embedding (1¢ per 1,000 embeddings)
- **Expected usage**: ~50 embeddings/day per user
- **Monthly cost per user**: $0.015 (~₹1)

### Firebase Firestore
- **Reads**: $0.06 per 100K
- **Writes**: $0.18 per 100K
- **Storage**: $0.18 per GB
- **Expected**: ~5GB for 10K users = $0.90/month

**Total: ~₹75/month for 10,000 active users** ✅

---

## 🚧 Limitations & Considerations

1. **Vector Index Creation**: Takes 10-15 mins after first deployment
2. **Cold Start**: First embedding generation may be slow
3. **Offline**: Falls back to local keyword search
4. **Migration**: Existing memories won't have vectors initially

---

## 🎯 Success Criteria

- ✅ AI remembers user health data across chats
- ✅ Semantic search works (finds "diabetes" when searching "blood sugar")
- ✅ Profile summary auto-updates with important info
- ✅ Search returns results in <500ms
- ✅ Works across devices (Firebase sync)

---

## 🔄 Migration Strategy

### Phase A: Parallel Running (Week 1)
- Both old and new memory systems active
- New memories get vectors
- Old memories remain local

### Phase B: Background Migration (Week 2)
- Script to generate embeddings for existing memories
- Run during low-traffic hours
- Monitor costs and performance

### Phase C: Full Cutover (Week 3)
- Switch primary search to vector-based
- Keep local search as fallback
- Monitor user experience

---

## 📚 Resources

- **Firebase Vector Search**: https://firebase.google.com/docs/firestore/vector-search
- **Gemini Embeddings**: https://ai.google.dev/gemini-api/docs/embeddings
- **MemGPT Paper**: https://arxiv.org/abs/2310.08560

---

## ✅ Next Steps

1. **Run** Phase 1 tests (profile summary working)
2. **Implement** Step 1-4 (Firebase vector setup)
3. **Test** with sample health data
4. **Deploy** to production
5. **Monitor** costs and performance

**Total Implementation Time: ~2-3 hours** 🚀
