# Health Intake UI Integration Guide

## ✅ Completed Changes

### 1. System Prompt Updates (`src/lib/systemPrompts.ts`)
- ✅ Added `multiSelect` field to question format
- ✅ Updated examples to show single/multi-select usage
- ✅ Clear instructions for when to use each type

### 2. TypeScript Interface (`src/lib/healthIntake.ts`)
- ✅ Added `multiSelect?: boolean` to `HealthIntakeQuestion` interface

### 3. New Professional UI Component (`src/components/Chat/HealthIntakeModal.tsx`)
- ✅ Created beautiful modal component matching the screenshot design
- ✅ Progress indicator at top with percentage
- ✅ Clean card layout with proper spacing
- ✅ Radio buttons for single-select (circular)
- ✅ Checkboxes for multi-select (square with checkmark)
- ✅ **Auto-advance on single-select** - automatically moves to next question after selection
- ✅ Back and Next buttons properly positioned
- ✅ Back button disabled on first question
- ✅ Next button disabled until answer selected
- ✅ Smooth transitions and animations
- ✅ Dark mode support
- ✅ Gradient progress bar
- ✅ Professional typography and spacing

## 🔧 Required Integration in ChatContainer.tsx

Since ChatContainer.tsx currently has the old intake UI embedded, you need to replace it with the new modal.

### Step 1: Add import at the top
```typescript
import HealthIntakeModal from './HealthIntakeModal';
```

### Step 2: Find the old intake UI rendering (around line 230-340)
Look for the section that renders intake questions with this pattern:
```typescript
{awaitingIntake && intake && (
  <div className="...">
    {/* Old intake UI code */}
  </div>
)}
```

### Step 3: Replace with new modal
```typescript
{awaitingIntake && intake && (
  <HealthIntakeModal
    questions={intake.questions}
    onSubmit={(answers) => {
      // Convert answers to JSON string and submit
      const jsonPayload = JSON.stringify(answers);
      submitIntake(jsonPayload);
      setAwaitingIntake(false);
    }}
    onClose={() => {
      setAwaitingIntake(false);
      setIntake(null);
    }}
  />
)}
```

### Step 4: Remove old state variables (if any)
The old implementation might have had `intakeIndex` state - this is no longer needed as the modal handles its own state internally.

## 🎨 Design Features

### Professional Design Elements:
1. **Progress Tracking**: Visual progress bar with percentage completion
2. **Smart Selection**: 
   - Single-select: Auto-advances after 600ms delay for smooth UX
   - Multi-select: User explicitly clicks Next after selecting multiple options
3. **Visual Indicators**:
   - Radio buttons (circles) for single-select
   - Checkboxes (squares) for multi-select
   - Clear selected state with primary color and shadow
4. **Navigation**:
   - Back button (disabled on first question)
   - Next button (disabled until answer selected)
   - Submit button on last question
5. **Accessibility**:
   - Large tap targets (48px minimum)
   - Clear visual feedback on hover/selection
   - Keyboard navigation support
   - ARIA-friendly structure

### How Multi-Select Works:
- AI sets `"multiSelect": true` in the question
- UI renders checkboxes instead of radio buttons
- User can select multiple options
- Shows "You can select multiple options" hint
- User clicks Next to proceed (no auto-advance)

### How Single-Select Works:
- AI sets `"multiSelect": false` or omits it
- UI renders radio buttons
- User selects one option
- **Automatically advances** after 600ms
- Smooth transition to next question

## 🔄 Migration Benefits

### Before (Old UI):
- ❌ Basic list with continue buttons
- ❌ No visual progress indicator
- ❌ Manual click required for every question
- ❌ No distinction between single/multi-select
- ❌ Basic styling

### After (New UI):
- ✅ Modern modal with professional design
- ✅ Progress bar with percentage
- ✅ Auto-advance for single-select questions
- ✅ Smart radio/checkbox selection based on question type
- ✅ Beautiful animations and transitions
- ✅ Dark mode support
- ✅ Better UX matching modern health apps

## 📝 Example Question Flow

**Question 1 (Single-select):**
```json
{
  "id": "q1",
  "text": "When did your symptoms start?",
  "options": ["Today", "Yesterday", "2-3 days ago", "Over a week ago"],
  "multiSelect": false
}
```
→ User clicks "Today" → Auto-advances to Q2 after 600ms

**Question 2 (Multi-select):**
```json
{
  "id": "q2",
  "text": "Which symptoms are you experiencing? (Select all that apply)",
  "options": ["Headache", "Fever", "Cough", "Fatigue", "Nausea"],
  "multiSelect": true
}
```
→ User checks "Headache", "Fever", "Cough" → Clicks Next button

## 🎯 Testing Checklist

After integration, test:
- [ ] Single-select auto-advances correctly
- [ ] Multi-select allows multiple selections
- [ ] Multi-select requires manual Next click
- [ ] Progress bar updates correctly
- [ ] Back button works and preserves previous answers
- [ ] First question has Back button disabled
- [ ] Last question shows "Submit" instead of "Next"
- [ ] Submit triggers the intake answer flow
- [ ] Close button cancels the intake
- [ ] Dark mode looks good
- [ ] Mobile responsive layout works
- [ ] Animations are smooth

## 💡 Tips for Implementation

1. **Search for the old intake code**: Look for `intakeIndex`, `setIntakeIndex`, or the old intake rendering
2. **Backup first**: Save the current ChatContainer.tsx before modifying
3. **Test thoroughly**: Make sure answers are being collected correctly
4. **Check console**: Watch for any TypeScript errors
5. **Verify AI responses**: Ensure the AI is setting `multiSelect` correctly in JSON

## 🚀 Expected User Experience

1. User asks health question: "I have a headache"
2. System shows "Preparing health assessment" loading
3. **New beautiful modal appears** with first question
4. Progress bar shows "20% complete" (1 of 5 questions)
5. User selects answer from radio buttons
6. **Question auto-advances** smoothly to next
7. For multi-select questions, user selects multiple and clicks Next
8. User can go back to change answers
9. On last question, clicks Submit
10. Modal closes, AI processes answers and provides personalized health guidance

This creates a **professional, modern health assessment experience** similar to leading healthcare apps!
