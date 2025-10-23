# Memory System - Which Files to Use

## ✅ USE THESE FILES

### Core Memory System

1. **`src/lib/memoryEnhanced.ts`** ✓
   - 4-tier memory architecture
   - Local storage
   - Automatic context management
   - **Keep and use this**

2. **`src/lib/aiMemoryExtractor.ts`** ✓ NEW
   - AI-driven extraction (no regex!)
   - Function declarations for AI
   - Background memory storage
   - **Use this for AI extraction**

3. **`src/lib/vectorMemoryHybrid.ts`** ✓
   - Works with Realtime Database
   - Stores vectors in Firestore
   - Semantic search
   - **Use this for vector storage**

4. **`src/lib/embeddingService.ts`** ✓
   - Generates 768-dim vectors
   - Cosine similarity
   - **Use this for embeddings**

5. **`src/lib/memoryFunctions.ts`** ✓
   - AI search functions
   - Function declarations
   - **Use this for AI search**

---

## ❌ DELETE THESE FILES

1. **`src/lib/vectorMemory.ts`** ✗
   - **Status: Already deleted**
   - Replaced by vectorMemoryHybrid.ts
   - Don't use this

2. **`src/lib/memory.ts`** ✗ (Optional to delete)
   - Old simple memory
   - Replaced by memoryEnhanced.ts
   - Can keep for backwards compatibility or delete

---

## 📋 File Usage Summary

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `memoryEnhanced.ts` | 4-tier memory system | ✅ Active | Use |
| `aiMemoryExtractor.ts` | AI extraction (no regex) | ✅ New | Use |
| `vectorMemoryHybrid.ts` | Realtime DB + Firestore | ✅ Active | Use |
| `embeddingService.ts` | Generate embeddings | ✅ Active | Use |
| `memoryFunctions.ts` | AI search functions | ✅ Active | Use |
| `vectorMemory.ts` | Old vector service | ❌ Deleted | - |
| `memory.ts` | Old simple memory | ⚠️ Legacy | Delete or keep for compatibility |

---

## 🔄 Integration Map

```
┌─────────────────────────────────────────────────┐
│  aiRouter.ts                                    │
│  ├── Imports: memoryFunctions.ts               │
│  ├── Imports: aiMemoryExtractor.ts             │
│  └── Handles: Function calls from AI           │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  AI Response (Gemini)                           │
│  ├── Calls: extractImportantInfo()             │
│  ├── Calls: updateUserProfileSummary()         │
│  └── Calls: searchSemanticMemory()             │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  aiMemoryExtractor.ts                           │
│  ├── Executes: Function calls                  │
│  ├── Stores in: memoryEnhanced.ts (local)      │
│  └── Stores in: vectorMemoryHybrid.ts (vector) │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  Storage Layer                                  │
│  ├── memoryEnhanced.ts → LocalStorage          │
│  ├── vectorMemoryHybrid.ts → Firestore         │
│  └── embeddingService.ts → Generate vectors    │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Quick Reference

**When user sends message:**
1. Store in Realtime Database (existing code)
2. AI processes and responds
3. AI extracts important info (aiMemoryExtractor.ts)
4. Stores locally (memoryEnhanced.ts)
5. Stores vectors (vectorMemoryHybrid.ts)

**When user searches memory:**
1. AI calls searchSemanticMemory()
2. Executes via memoryFunctions.ts
3. Searches vectorMemoryHybrid.ts
4. Returns results with similarity scores

**No regex patterns anywhere!**
AI decides what's important.

---

## ✨ Clean Implementation

Total active memory files: **5**
1. memoryEnhanced.ts (local memory)
2. aiMemoryExtractor.ts (AI extraction)
3. vectorMemoryHybrid.ts (vector storage)
4. embeddingService.ts (embeddings)
5. memoryFunctions.ts (search functions)

All other files deleted or unused.
Simple, clean, AI-driven! 🚀
