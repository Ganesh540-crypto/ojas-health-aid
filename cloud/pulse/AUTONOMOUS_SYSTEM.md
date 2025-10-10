# Autonomous Pulse Feed System

## The Problem You Identified (100% Correct!)

**Old System (WRONG)**:
```
Hardcoded topics → AI generates queries → Search → Synthesize
   ↓
"diabetes", "mental health", "heart disease"
   ↓
Always the same generic topics
```

**Your Vision (CORRECT)**:
```
AI discovers trending topics → AI generates queries → Search → Synthesize
   ↓
"GPT-5 launch", "Stock market crash", "Cricket final", "New drug approval"
   ↓
Fresh, specific, trending topics discovered autonomously
```

## How It Works Now

### Step 1: Autonomous Topic Discovery
Gemini analyzes current trends and discovers specific topics:

**Input**: Category (e.g., "health") + Region (e.g., "IN") + Date (today)

**Gemini thinks**:
- What major health events happened in the last 7 days?
- What are people searching for TODAY?
- What breaking news is happening?
- What announcements or developments occurred?

**Output**: Specific trending topics with priority scores
```json
{
  "topics": [
    {
      "topic": "New Alzheimer's drug FDA approval October 2025",
      "category": "health",
      "priority": 9,
      "reasoning": "Major breakthrough, affects millions"
    },
    {
      "topic": "Dengue outbreak Mumbai monsoon 2025",
      "category": "health", 
      "priority": 8,
      "reasoning": "Current public health emergency"
    }
  ]
}
```

### Step 2: Human-Style Query Generation
For each discovered topic, generate natural search queries:

**Topic**: "New Alzheimer's drug FDA approval October 2025"

**Queries generated**:
- "latest Alzheimer's drug approval updates 2025"
- "FDA Alzheimer's treatment policy changes 2025"
- "Alzheimer's drug research reports October 2025"
- "government Alzheimer's treatment guidelines 2025"

### Step 3: Google Search
Each query searches Google CSE → 30-40 diverse sources per topic

### Step 4: Clustering
Group sources into specific stories (e.g., "FDA approves lecanemab for early Alzheimer's")

### Step 5: Comprehensive Synthesis
Generate **1500-2500 word** in-depth articles:
- **Title**: Compelling headline (8-15 words)
- **Lede**: Strong opening (3-4 sentences, WHO/WHAT/WHEN/WHERE/WHY/HOW)
- **Body**: 8-15 substantial paragraphs (4-6 sentences each)
- **Key Points**: 6-10 distinct insights
- **Tags**: 6-12 relevant topics

## Architecture

```
Cloud Scheduler (Cron)
    ↓
autonomous-research function
    ↓
┌─────────────────────────────────────┐
│ 1. discoverTrendingTopics()         │
│    - Gemini analyzes current trends │
│    - Returns 5-15 specific topics   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. For each discovered topic:       │
│    - searchViaGeminiFunctionCalling │
│    - Generates 3-5 human queries    │
│    - Searches Google CSE            │
│    - Returns 30-40 sources          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. categorizeSources()              │
│    - Clusters sources into stories  │
│    - Writes to pulse_sources        │
└─────────────────────────────────────┘
    ↓
synthesize-clusters function (runs every 4 hours)
    ↓
┌─────────────────────────────────────┐
│ 4. Reads pulse_sources              │
│    - Generates comprehensive article│
│    - 1500-2500 words                │
│    - Writes to pulse_articles       │
└─────────────────────────────────────┘
    ↓
Frontend displays articles
```

## Deployment

### 1. Build and Deploy Functions
```powershell
cd cloud\pulse\scripts
.\deploy-autonomous.ps1
```

This deploys:
- **autonomous-research**: Discovers topics + researches + clusters
- **synthesize-clusters**: Generates comprehensive articles

### 2. Setup Scheduler
```powershell
.\setup-autonomous-scheduler.ps1
```

This creates 7 scheduler jobs:
- **pulse-autonomous-health**: 2 AM daily (8 topics)
- **pulse-autonomous-technology**: 6 AM daily (10 topics)
- **pulse-autonomous-science**: 10 AM daily (6 topics)
- **pulse-autonomous-business**: 2 PM daily (8 topics)
- **pulse-autonomous-sports**: 6 PM daily (6 topics)
- **pulse-autonomous-entertainment**: 10 PM daily (6 topics)
- **pulse-autonomous-all**: Midnight daily (15 topics across all categories)
- **pulse-synthesize**: Every 4 hours

## Testing

### Test Topic Discovery
```powershell
$URL = gcloud functions describe autonomous-research --gen2 --region us-central1 --format="value(url)"
$TOKEN = gcloud auth print-identity-token

# Discover health topics
Invoke-RestMethod -Uri "$URL?category=health&region=IN&maxTopics=5" -Headers @{"Authorization"="Bearer $TOKEN"}

# Discover across all categories
Invoke-RestMethod -Uri "$URL?region=IN&maxTopics=10" -Headers @{"Authorization"="Bearer $TOKEN"}
```

### Test Synthesis
```powershell
$URL = gcloud functions describe synthesize-clusters --gen2 --region us-central1 --format="value(url)"
$TOKEN = gcloud auth print-identity-token

Invoke-RestMethod -Uri "$URL?limit=10&region=IN" -Headers @{"Authorization"="Bearer $TOKEN"}
```

### Test Scheduler Job
```powershell
gcloud scheduler jobs run pulse-autonomous-health --location=us-central1
```

## Examples

### What Gemini Discovers

**Health**:
- "New Alzheimer's drug FDA approval October 2025"
- "Dengue outbreak Mumbai monsoon season"
- "ICMR diabetes screening program launch 100 districts"
- "WHO declares mpox public health emergency"

**Technology**:
- "GPT-5 model launch OpenAI"
- "iPhone 17 Pro Max announcement Apple event"
- "Google Gemini 3.0 release features"
- "Tesla Cybertruck India launch date"

**Business**:
- "Nifty 50 crosses 25000 milestone October 2025"
- "Reliance Industries AGM 2025 major announcements"
- "US Federal Reserve interest rate cut decision"
- "Adani Group stock crash investigation update"

**Sports**:
- "India vs Australia cricket World Cup final"
- "IPL 2025 mega auction player prices"
- "Virat Kohli retirement announcement"
- "Paris Olympics 2025 India medal tally"

### What Gets Generated

For topic: **"GPT-5 model launch OpenAI"**

**Queries**:
- "latest GPT-5 updates OpenAI 2025"
- "GPT-5 launch announcement details"
- "GPT-5 vs GPT-4 comparison features"
- "OpenAI GPT-5 release date pricing"

**Sources**: 30-40 articles from TechCrunch, Verge, OpenAI blog, etc.

**Article**: 1500-2500 word comprehensive piece covering:
- Launch announcement details
- New capabilities and improvements
- Comparison with GPT-4
- Pricing and availability
- Industry reactions
- Implications for AI development
- Expert perspectives
- Technical specifications
- Use cases and applications
- Future roadmap

## Key Differences from Old System

| Aspect | Old System | New Autonomous System |
|--------|-----------|----------------------|
| **Topic Source** | Hardcoded in script | Gemini discovers autonomously |
| **Topic Type** | Generic ("diabetes") | Specific ("New Alzheimer's drug FDA approval") |
| **Freshness** | Always same topics | New topics every day |
| **Coverage** | Limited to predefined | Covers breaking news, launches, events |
| **Query Style** | Still good (human-style) | Same (human-style) |
| **Article Length** | 250-500 words | 1500-2500 words |
| **Comprehensiveness** | Basic summary | In-depth analysis |

## Configuration

### Change Discovery Frequency
Edit `setup-autonomous-scheduler.ps1`:
```powershell
# Current: Health at 2 AM daily
@{ name = "health"; schedule = "0 2 * * *"; maxTopics = 8 }

# Change to: Every 6 hours
@{ name = "health"; schedule = "0 */6 * * *"; maxTopics = 8 }

# Change to: Twice daily (6 AM, 6 PM)
@{ name = "health"; schedule = "0 6,18 * * *"; maxTopics = 8 }
```

### Add More Categories
```powershell
$categories = @(
    @{ name = "health"; schedule = "0 2 * * *"; maxTopics = 8 },
    @{ name = "technology"; schedule = "0 6 * * *"; maxTopics = 10 },
    @{ name = "politics"; schedule = "0 12 * * *"; maxTopics = 8 },  # NEW
    @{ name = "environment"; schedule = "0 16 * * *"; maxTopics = 6 }  # NEW
)
```

### Change Max Topics
```powershell
# Discover more topics per run
@{ name = "health"; schedule = "0 2 * * *"; maxTopics = 15 }  # Was 8
```

### Change Region
Edit the scheduler URLs:
```powershell
$targetUrl = "$FUNCTION_URL`?category=$($cat.name)&region=US&maxTopics=$($cat.maxTopics)"
#                                                            ^^
```

## Cost Estimate

### Per Category Per Day
- Topic discovery: 1 Gemini call (~$0.001)
- Query generation: 5-10 topics × 1 Gemini call each (~$0.01)
- Google CSE: 5-10 topics × 4 queries × 8 results (~$0.20)
- Clustering: 5-10 topics × 1 Gemini call (~$0.01)
- Synthesis: 10-20 articles × 1 Gemini call (~$0.10)

**Total per category**: ~$0.32/day

### All Categories (6) + All-Categories Job
- ~$2.50/day
- ~$75/month

**Much cheaper than news subscriptions, fully automated!**

## Monitoring

### View Discovered Topics
```powershell
# Check logs
gcloud functions logs read autonomous-research --region=us-central1 --limit=100
```

### View Firestore
- **pulse_sources**: Clusters from discovery
- **pulse_articles**: Final synthesized articles

### Check Scheduler Status
```powershell
gcloud scheduler jobs list --location=us-central1
```

## Summary

✅ **NO predefined topics** - Gemini discovers trending topics autonomously  
✅ **Specific, current topics** - "GPT-5 launch", not "AI news"  
✅ **Human-style queries** - "latest updates 2025", not "diabetes India"  
✅ **Comprehensive articles** - 1500-2500 words, not 250-500  
✅ **Fully automated** - Runs on schedule, no manual intervention  
✅ **Multi-category** - Health, tech, science, business, sports, entertainment  
✅ **Cost-effective** - ~$75/month for complete news coverage  

**This is exactly what you asked for!** 🎉
