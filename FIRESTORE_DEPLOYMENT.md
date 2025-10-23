# Firestore Rules Deployment

## File Structure

1. **`firestore.rules`** - Combined rules for ALL databases (used by `firebase deploy`)
2. **`firestore.pulse.rules`** - Pulse-only rules (reference)
3. **`firestore.memory.rules`** - AI Memory-only rules (reference)

## How It Works

**Important:** Firebase applies rules from `firestore.rules` to **ALL** Firestore databases in your project.

You have 2 databases:
- **(default)** in us-central1 → Pulse collections
- **default** in asia-south1 → AI Memory collections

The rules in `firestore.rules` cover both!

## Deploy Rules

```bash
# Deploy to ALL databases
firebase deploy --only firestore:rules
```

## Manual Deployment (Advanced)

If you need to deploy different rules to each database:

### Deploy to Pulse Database:
```bash
firebase firestore:rules:update firestore.pulse.rules --database=(default)
```

### Deploy to Memory Database:
```bash
firebase firestore:rules:update firestore.memory.rules --database=default
```

## Current Setup

✅ **firestore.rules** contains BOTH:
- Pulse collections rules
- Vector memories rules
- Default deny for everything else

Just deploy once:
```bash
firebase deploy --only firestore:rules
```

This applies the rules to both databases automatically! 🚀
