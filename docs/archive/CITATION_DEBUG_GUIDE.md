# Citation Debug Guide

## What Was Fixed

### 1. Red Line Errors (✅ FIXED)
- **Removed bad import** on line 4 of `systemPrompts.ts`
- **Fixed TypeScript lint errors** by removing backticks around `[n]` examples in system prompts

### 2. **PROGRAMMATIC CITATION INJECTION** (✅ IMPLEMENTED - Like Perplexity/Pulse)
- **The Real Fix**: Added `injectCitations()` function that programmatically inserts `[n]` based on Gemini's grounding segment data
- **How it works**: 
  - Gemini provides `groundingSupports` with `segment.startIndex` and `segment.endIndex` 
  - We map segments to sources and inject `[1]`, `[2]` at the appropriate positions
  - This is exactly how Perplexity/Pulse do citations - they don't rely on the model to write them
- **Implementation**: Both `geminiLite.ts` and `gemini.ts` now have this function

### 3. Citation Rendering (✅ ENHANCED WITH DEBUG LOGGING)
- Added console logging to trace the entire citation pipeline:
  - `geminiLite.ts`: Logs source extraction, citation injection count
  - `gemini.ts`: Logs citation injection for health queries
  - `ChatMessage.tsx`: Logs remark plugin execution and citation transformation

## How to Test Citations

### Test Query Example
```
"Top cricket bats under ₹5,000 with sources"
```

### What to Check in Browser Console

1. **Source Extraction** (from geminiLite.ts):
   ```
   📋 [GeminiLite] Extracted sources: 3
   📝 [GeminiLite] Citations in text - before: false after: true
   ```

2. **Citation Plugin** (from ChatMessage.tsx):
   ```
   🔗 remarkCitationsPlugin called with sources: 3
   📌 Found citation [1] → https://example.com/article1
   📌 Found citation [2] → https://example.com/article2
   ```

### Expected Behavior

✅ **Sources Card** appears above the answer  
✅ **Inline citations** `[1]`, `[2]` appear as superscript links in the text  
✅ **Clicking `[n]`** opens the corresponding source URL  

## If Citations Still Don't Show

### Possible Causes:

1. **No web search triggered**
   - Check console for: `📋 [GeminiLite] Extracted sources: 0`
   - Solution: Query must contain keywords like "best", "top", "₹", "price", "latest", "2024", etc.

2. **Model didn't include [n] in response**
   - Check console: `Citations in text - before: false after: true`
   - If "after: true" → fallback injected "References: [1], [2]..." at end
   - If "after: false" → sources exist but no [n] markers anywhere (rare)

3. **Remark plugin not detecting [n]**
   - Check console for: `⚠️ No sources available for citation linking`
   - This means sources prop wasn't passed to ChatMessage

4. **Old cached response**
   - Try a completely new query in a new chat
   - The old response was generated before all these fixes

## Debugging Steps

1. Open Browser DevTools Console (F12)
2. Send a product/shopping query with "with sources" or "latest"
3. Look for the emoji-prefixed logs: 📋 📝 🔗 📌
4. Check if sources > 0 and citations were detected

## Quick Fix Checklist

- [ ] Removed bad import from systemPrompts.ts
- [ ] No TypeScript red lines in systemPrompts.ts
- [ ] Browser console shows source extraction logs
- [ ] Browser console shows citation plugin logs
- [ ] Sources card appears above message
- [ ] Inline [n] superscripts are clickable

## Clean Up (After Debugging)

Once citations are working, remove console.log statements from:
- `src/lib/geminiLite.ts` (lines with 📋 📝 emojis)
- `src/components/Chat/ChatMessage.tsx` (lines with 🔗 📌 emojis)
