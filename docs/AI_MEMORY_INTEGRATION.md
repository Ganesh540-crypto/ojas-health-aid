# AI-Driven Memory Integration Guide

## 🧠 Core Concept

**OLD WAY (Bad):** Use regex patterns to detect important info
```typescript
if (/blood sugar|medication/.test(message)) {
  storeMemory(); // Dumb pattern matching
}
```

**NEW WAY (Smart):** Let AI decide what's important
```typescript
// AI analyzes during response and calls:
extractImportantInfo({
  content: "User has Type 2 diabetes, takes metformin 500mg",
  type: "health_data",
  summary: "User manages diabetes with metformin"
});
```

## 🔄 Integration Flow

```
User: "I'm 32, work as a software engineer, have diabetes, take metformin"
          ↓
    [AI Router] → Routes to appropriate model
          ↓
    [AI Responds] "I understand you're managing diabetes..."
          ↓ (PARALLEL - Background)
    [AI Extracts Memory] via function calls:
      1. extractImportantInfo({
           content: "32 years old, software engineer",
           type: "personal_info",
           summary: "32-year-old software engineer"
         })
      2. extractImportantInfo({
           content: "Type 2 diabetes, takes metformin",
           type: "health_data",
           summary: "Manages diabetes with metformin"
         })
      3. updateUserProfileSummary({
           personalDetails: "32-year-old software engineer",
           healthSummary: "Type 2 diabetes, metformin treatment"
         })
          ↓
    [Stores in Background]
      → Enhanced Memory (Local)
      → Firestore (Vector embeddings) 
      → Realtime DB references maintained
```

## 📂 File Structure (Cleaned Up)

### ✅ Keep These Files

```
src/lib/
├── memoryEnhanced.ts          ← 4-tier memory system
├── memoryFunctions.ts         ← AI search functions
├── aiMemoryExtractor.ts       ← NEW: AI extraction functions
├── vectorMemoryHybrid.ts      ← Firestore + Realtime DB integration
├── embeddingService.ts        ← Generate vector embeddings
├── aiRouter.ts                ← Add memory functions here
├── gemini.ts                  ← Update to handle memory functions
└── geminiLite.ts              ← Update to handle memory functions
```

### ❌ Removed Files

- `vectorMemory.ts` ← Deleted (replaced by vectorMemoryHybrid.ts)
- No regex pattern matching anywhere!

## 🔧 Integration Steps

### Step 1: Update aiRouter.ts

```typescript
// At the top
import { 
  memoryManagementFunctions,
  executeMemoryFunction 
} from './memoryFunctions';
import { 
  memoryExtractionFunctions,
  executeMemoryExtraction 
} from './aiMemoryExtractor';

// Combine all memory functions
const allMemoryFunctions = {
  ...memoryManagementFunctions,  // Search, archive, etc.
  ...memoryExtractionFunctions,  // AI extraction
};

// When creating Gemini model
const model = this.ai.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{
    functionDeclarations: Object.values(allMemoryFunctions)
  }]
});

// Handle function calls in streaming response
// (Add to your existing function call handler)
if (part.functionCall) {
  const { name, args } = part.functionCall;
  
  // Check if it's a memory function
  if (name in memoryManagementFunctions) {
    const result = await executeMemoryFunction(name, args);
    // Send result back to model
  } else if (name in memoryExtractionFunctions) {
    // Run in background, don't block response
    executeMemoryExtraction(name, args, {
      chatId,
      messageId,
      userId: auth.currentUser?.uid
    }).catch(err => console.warn('Memory extraction failed:', err));
  }
}
```

### Step 2: Update System Prompts

Add to `src/lib/systemPrompts.ts`:

```typescript
export const MEMORY_EXTRACTION_INSTRUCTIONS = `
MEMORY MANAGEMENT:
You have access to memory functions to remember important information about the user.

WHEN TO EXTRACT MEMORY:
- User shares health data (conditions, medications, symptoms, measurements)
- User shares personal details (age, occupation, location, lifestyle)
- User expresses preferences (diet, exercise, communication style)
- Important facts that should be remembered long-term

HOW TO EXTRACT:
1. During your response, call extractImportantInfo() for specific facts
2. Call updateUserProfileSummary() when learning new profile information
3. Every 5-10 messages, call createConversationSummary() to summarize discussion

EXAMPLES:
User: "I'm 32, work as an engineer, have diabetes"
You respond AND call:
- extractImportantInfo({ content: "32 years old, engineer", type: "personal_info", summary: "32-year-old engineer" })
- extractImportantInfo({ content: "Has diabetes", type: "health_data", summary: "User has diabetes" })
- updateUserProfileSummary({ personalDetails: "32-year-old engineer", healthSummary: "Type 2 diabetes" })

User: "My blood sugar was 150 this morning"
You respond AND call:
- extractImportantInfo({ content: "Blood sugar 150 mg/dL morning", type: "health_data", summary: "Blood sugar reading: 150" })

IMPORTANT:
- Extract while responding (parallel, non-blocking)
- Be specific in content and summaries
- Don't extract trivial information
- Focus on facts that help future conversations
`;

// Add to OJAS_HEALTH_SYSTEM and OJAS_LITE_SYSTEM
export const OJAS_HEALTH_SYSTEM = `
${CORE_IDENTITY}

${MEMORY_EXTRACTION_INSTRUCTIONS}

// ... rest of prompt
`;
```

### Step 3: Test the Flow

```typescript
// User sends message
User: "I'm 32 years old, I have Type 2 diabetes, and I take metformin 500mg twice daily"

// AI processes
AI Response: "Thank you for sharing. I understand you're managing Type 2 diabetes with metformin..."

// AI ALSO calls (in background):
1. extractImportantInfo({
     content: "User is 32 years old",
     type: "personal_info",
     summary: "32 years old"
   })

2. extractImportantInfo({
     content: "User has Type 2 diabetes, takes metformin 500mg twice daily",
     type: "health_data",
     importance: "high",
     summary: "Type 2 diabetes, metformin 500mg BID"
   })

3. updateUserProfileSummary({
     personalDetails: "32 years old",
     healthSummary: "Type 2 diabetes managed with metformin 500mg twice daily"
   })

// Stored automatically:
✓ Local memory (instant access)
✓ Vector embeddings (semantic search)
✓ Profile summary (quick context)

// Next conversation (days later):
User: "Do you remember my medication?"
AI searches memory → "Yes, you take metformin 500mg twice daily for your Type 2 diabetes."
```

## 🎯 Key Benefits

| Aspect | Old (Regex) | New (AI-Driven) |
|--------|-------------|-----------------|
| **Accuracy** | Misses variations | Understands context |
| **Intelligence** | Pattern matching | Semantic understanding |
| **Flexibility** | Fixed patterns | Adapts to conversation |
| **Summaries** | None | AI-generated concise summaries |
| **Profile Updates** | Manual | Automatic during chat |
| **Example** | Misses "glucose" if looking for "blood sugar" | Understands they're the same |

## 🚀 Implementation Checklist

- [x] ✅ Create aiMemoryExtractor.ts
- [x] ✅ Clean up vectorMemoryHybrid.ts (remove regex)
- [x] ✅ Remove vectorMemory.ts
- [ ] ⏳ Update aiRouter.ts with memory functions
- [ ] ⏳ Update systemPrompts.ts with extraction instructions
- [ ] ⏳ Test with real conversation
- [ ] ⏳ Monitor what AI extracts
- [ ] ⏳ Tune extraction prompts

## 📊 What Gets Stored Where

```
User Message: "I'm 32, have diabetes, take metformin"
                    ↓
            [AI Analyzes & Extracts]
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
[Local Memory]          [Firestore + Vector]
├── Profile Summary     ├── "32 years old" [embedding]
├── Recall Memory       ├── "Type 2 diabetes" [embedding]
└── Archival Memory     └── "takes metformin" [embedding]
                                      ↓
                          [Realtime DB References]
                          chats/chat123/messages/msg456
```

## 💡 Advanced: Conversation Summaries

```typescript
// Every 10 messages or when topic changes, AI calls:
createConversationSummary({
  summary: "Discussed blood sugar management strategies and dietary modifications for diabetes control",
  keyPoints: [
    "User tracking blood sugar 3x daily",
    "Considering adding exercise routine",
    "Interested in low-carb diet options",
    "Plans to consult doctor about medication adjustment"
  ],
  importance: "high"
});

// Later (weeks later, different chat):
User: "What did we discuss about my diet last time?"
AI searches: "blood sugar diet diabetes"
→ Finds conversation summary
→ "We discussed low-carb diet options for better blood sugar control..."
```

## 🔍 Debugging

### Check What AI Is Extracting

```typescript
// Add logging in executeMemoryExtraction
console.log('🧠 AI extracted:', {
  function: functionName,
  args,
  chatId: context.chatId
});
```

### View Stored Memories

```typescript
import { enhancedMemoryStore } from '@/lib/memoryEnhanced';
import { vectorMemoryHybrid } from '@/lib/vectorMemoryHybrid';

// Check local
console.log('Profile:', enhancedMemoryStore.getCoreMemoryString());
console.log('Stats:', enhancedMemoryStore.getMemoryStats());

// Check Firestore
const results = await vectorMemoryHybrid.searchMemories("diabetes");
console.log('Vector search:', results);
```

### Test AI Extraction

```typescript
// Send test message
User: "I'm 25, work as a doctor, have no health issues"

// Check console for extraction calls
// Should see:
// 🧠 AI extracted: { function: 'extractImportantInfo', ... }
// 🧠 AI extracted: { function: 'updateUserProfileSummary', ... }
```

## ⚠️ Important Notes

1. **Non-Blocking**: Memory extraction runs in background, doesn't slow responses
2. **AI Decides**: No regex patterns - AI determines what's important
3. **Summaries**: AI creates concise summaries for better recall
4. **Cross-Chat**: Memories accessible across all conversations
5. **Hybrid Storage**: Local (fast) + Firestore (persistent) + Realtime DB (source of truth)

## 🎓 Next Steps

1. Update aiRouter.ts with function calling
2. Add memory instructions to system prompts
3. Test with sample conversation
4. Monitor console logs for extraction calls
5. Verify memories are stored correctly
6. Test semantic search across chats

---

**Status: Ready for Integration** 🚀

AI now intelligently extracts and remembers important information without any regex patterns!
