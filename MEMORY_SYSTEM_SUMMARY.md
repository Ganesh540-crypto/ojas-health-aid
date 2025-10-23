# Memory System - Realtime Database Only

## ✅ **Current Implementation**

### **Storage Location:**
Firebase Realtime Database: `users/{userId}/memory/`

### **Memory Structure:**

```
users/
  {userId}/
    memory/
      archival/          # Long-term facts (extractImportantInfo)
        {pushId}/
          content: "User dislikes beetroot"
          type: "user_preference"
          summary: "Dislikes beetroot"
          importance: "medium"
          chatId: "..."
          timestamp: ...
      
      summaries/         # Conversation summaries
        {pushId}/
          summary: "Discussed food preferences"
          keyPoints: [...]
          importance: "medium"
          chatId: "..."
          timestamp: ...
      
      profile/           # Core memory (always in context)
        name: "..."
        age: ...
        healthConditions: [...]
        medications: [...]
```

## 🔧 **How It Works:**

1. **User says:** "i dont like beetroot"

2. **AI responds naturally:** "Got it! I'll remember that."

3. **Behind the scenes:** AI returns function call:
   ```json
   {
     "name": "extractImportantInfo",
     "args": {
       "content": "User dislikes beetroot",
       "type": "user_preference",
       "summary": "Dislikes beetroot"
     }
   }
   ```

4. **AIRouter executes:** Saves to Realtime Database

5. **Future retrieval:** AI can search/recall this information

## 📝 **Key Files:**

- `aiMemoryExtractor.ts` - Handles function execution, saves to Realtime DB
- `memoryFunctions.ts` - Function declarations for AI
- `aiRouter.ts` - Executes function calls in background
- `systemPrompts.ts` - Updated with MemGPT-style instructions

## ⚠️ **Current Issue:**

**AI writes function calls as TEXT instead of using function calling mechanism:**
```
Wrong: "I'll remember that. [[function_call:extractImportantInfo{...}]]"
Right: Actually call the function (no text in response)
```

**Next Step:** Force function calling with better prompts or use `mode: 'ANY'`
