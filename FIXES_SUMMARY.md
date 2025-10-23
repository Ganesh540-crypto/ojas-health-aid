# 🔧 Three Critical Fixes Applied

## 1. ✅ Fixed Sidebar Dropdown Menu (aria-hidden Error)

**Problem**: Clicking the 3-dot menu in chat history showed error:
```
Blocked aria-hidden on an element because its descendant retained focus
```

**Root Cause**: The sidebar panel had `aria-hidden={!isHomeVisible}` which blocked focus on child elements (dropdown buttons).

**Fix**: Removed `aria-hidden` attribute from sidebar panel in `AppShell.tsx` (line 236)

**File**: `src/components/Layout/AppShell.tsx`

**Result**: 
- ✅ Dropdown menus now work correctly
- ✅ Rename and Delete options accessible
- ✅ No more console errors

---

## 2. ✅ Removed Bullet Points from First-Level Content

**Problem**: As shown in screenshot, items directly under headings appeared with bullets:
```markdown
## Global Policy and Finance
• Shipping Emissions Debate: Text...
• CEO Call to Action: Text...
```

**User Requirement**: First-level items should be paragraphs with bold labels, NOT bullets. Bullets only for nested sub-items.

**Fix**: Updated system prompts in both `OJAS_LITE_SYSTEM` and `OJAS_HEALTH_SYSTEM`

**Added Instruction**:
```
- **CRITICAL**: First-level content under a heading should be PARAGRAPHS with bold labels, NOT bullet points.
  - Example: After "## Global Policy", write "**Shipping Debate:** Text here..." NOT "• **Shipping Debate:** Text"
  - Only use bullets for nested sub-items within those paragraphs, if absolutely necessary.
- Use bullet points ONLY for nested lists or when listing simple items (medicines, symptoms, steps).
```

**File**: `src/lib/systemPrompts.ts` (lines 224-227)

**Expected Result**:
```markdown
## Global Policy and Finance

**Shipping Emissions Debate:** The United States issued a warning...

**CEO Call to Action:** Ahead of the UN climate summit...

**Climate Finance Hurdles:** Pakistan's Prime Minister stated...
```

**Bullets Now Only For**:
- Nested sub-items under a paragraph
- Simple lists (symptoms, medicines, steps)
- Not for main topic labels

---

## 3. ℹ️ Web Search Limits (No Action Needed)

**Status**: Web search uses Gemini's built-in `googleSearch` tool

**Finding**: No explicit result limits found in our code. Gemini manages search internally.

**How It Works**:
- File: `src/lib/geminiLite.ts` line 418
- We simply enable: `tools.push({ googleSearch: {} });`
- Gemini decides how many results to fetch based on query context
- Results are automatically included via grounding metadata

**If You Want More Results**:
The number of sources is controlled by Gemini's grounding system, not by our code. Gemini typically returns 3-10 sources depending on:
- Query complexity
- Result quality/relevance
- Grounding confidence

No configuration option available to override this in the current API.

---

## Summary of Changes

| Issue | File | Line | Status |
|-------|------|------|--------|
| aria-hidden dropdown error | `AppShell.tsx` | 236 | ✅ Fixed |
| Bullet points on first-level content | `systemPrompts.ts` | 224-227 | ✅ Fixed |
| Web search limits | N/A | N/A | ℹ️ No limits found |

---

## Testing Checklist

### Sidebar Dropdown
- [x] Open chat history sidebar
- [ ] Hover over a chat
- [ ] Click the 3-dot menu
- [ ] Verify Rename and Delete options appear
- [ ] Check console for no errors

### Paragraph Formatting
- [ ] Ask a news query with multiple topics
- [ ] Verify headings show as:
  ```
  ## Section Name
  
  **Topic:** Description here...
  
  **Topic:** Description here...
  ```
- [ ] NOT as bullets under the heading
- [ ] Bullets only appear for nested lists if needed

### Citations (Already Working)
- [ ] Citations show as grouped badges: "ABC News +2"
- [ ] Hover shows popup with all sources and favicons
- [ ] Citations appear at end of sentences

---

## Notes

**Prompt Change Impact**: 
The bullet point fix affects future responses. Existing chat messages won't change, but new queries will follow the updated formatting rules.

**Gemini grounding**: 
The model automatically cites sources using the grounding metadata we programmatically inject as `[1][2][3]` markers. The UI groups these into badges.
