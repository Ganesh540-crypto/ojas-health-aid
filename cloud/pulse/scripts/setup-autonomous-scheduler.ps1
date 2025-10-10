#!/usr/bin/env pwsh
# Setup Cloud Scheduler for AUTONOMOUS topic discovery
# NO predefined topics - Gemini discovers trending topics automatically

Write-Host "🤖 Setting up Autonomous Pulse Feed Scheduler" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ID = "ojas-ai"
$REGION = "us-central1"

# Get function URL
$FUNCTION_URL = gcloud functions describe autonomous-research --gen2 --region $REGION --format="value(url)" 2>$null

if (-not $FUNCTION_URL) {
    Write-Host "❌ autonomous-research function not deployed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Deploy it first:" -ForegroundColor Yellow
    Write-Host "  cd cloud\pulse" -ForegroundColor Gray
    Write-Host "  npm run build" -ForegroundColor Gray
    Write-Host "  gcloud functions deploy autonomous-research --gen2 --region=us-central1 --runtime=nodejs20 --source=. --entry-point=autonomousResearchHttp --trigger-http --no-allow-unauthenticated --set-env-vars=`"GEMINI_API_KEY=YOUR_KEY,GOOGLE_SEARCH_API_KEY=YOUR_KEY,GOOGLE_SEARCH_ENGINE_ID=YOUR_ID`" --timeout=540s --memory=1GB" -ForegroundColor Gray
    exit 1
}

Write-Host "📍 Function URL: $FUNCTION_URL" -ForegroundColor Gray
Write-Host ""

# Create service account for scheduler (if not exists)
Write-Host "👤 Creating service account..." -ForegroundColor Yellow
$SA_NAME = "pulse-scheduler"
$SA_EMAIL = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID 2>$null
if ($LASTEXITCODE -ne 0) {
    gcloud iam service-accounts create $SA_NAME `
        --display-name="Pulse Feed Scheduler" `
        --project=$PROJECT_ID
    Write-Host "  ✅ Service account created" -ForegroundColor Green
} else {
    Write-Host "  ✅ Service account exists" -ForegroundColor Green
}

# Grant invoker permission
Write-Host "🔐 Granting Cloud Functions Invoker role..." -ForegroundColor Yellow
gcloud functions add-invoker-policy-binding autonomous-research `
    --region=$REGION `
    --member="serviceAccount:$SA_EMAIL" `
    --project=$PROJECT_ID 2>$null
Write-Host "  ✅ Permission granted" -ForegroundColor Green
Write-Host ""

# Define categories (Gemini will discover specific topics within each)
$categories = @(
    @{ name = "health"; schedule = "0 2 * * *"; maxTopics = 8 },      # 2 AM daily
    @{ name = "technology"; schedule = "0 6 * * *"; maxTopics = 10 }, # 6 AM daily
    @{ name = "science"; schedule = "0 10 * * *"; maxTopics = 6 },    # 10 AM daily
    @{ name = "business"; schedule = "0 14 * * *"; maxTopics = 8 },   # 2 PM daily
    @{ name = "sports"; schedule = "0 18 * * *"; maxTopics = 6 },     # 6 PM daily
    @{ name = "entertainment"; schedule = "0 22 * * *"; maxTopics = 6 } # 10 PM daily
)

Write-Host "📅 Creating autonomous scheduler jobs..." -ForegroundColor Yellow
Write-Host ""

foreach ($cat in $categories) {
    $jobName = "pulse-autonomous-$($cat.name)"
    $targetUrl = "$FUNCTION_URL`?category=$($cat.name)&region=IN&maxTopics=$($cat.maxTopics)"
    
    Write-Host "  🤖 $($cat.name)" -ForegroundColor Gray
    Write-Host "     Schedule: $($cat.schedule) (IST)" -ForegroundColor DarkGray
    Write-Host "     Max topics: $($cat.maxTopics)" -ForegroundColor DarkGray
    Write-Host "     Gemini will discover trending topics autonomously" -ForegroundColor DarkGray
    
    # Delete existing job if present
    gcloud scheduler jobs delete $jobName --location=$REGION --project=$PROJECT_ID --quiet 2>$null
    
    # Create new job
    gcloud scheduler jobs create http $jobName `
        --location=$REGION `
        --schedule="$($cat.schedule)" `
        --uri="$targetUrl" `
        --http-method=GET `
        --oidc-service-account-email=$SA_EMAIL `
        --oidc-token-audience=$FUNCTION_URL `
        --time-zone="Asia/Kolkata" `
        --attempt-deadline=540s `
        --project=$PROJECT_ID 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "     ✅ Created" -ForegroundColor Green
    } else {
        Write-Host "     ❌ Failed" -ForegroundColor Red
    }
    Write-Host ""
}

# Create all-categories job (runs less frequently)
Write-Host "  🌍 all-categories (cross-category discovery)" -ForegroundColor Gray
Write-Host "     Schedule: 0 0 * * * (midnight IST)" -ForegroundColor DarkGray
Write-Host "     Discovers top 15 trending topics across ALL categories" -ForegroundColor DarkGray

gcloud scheduler jobs delete pulse-autonomous-all --location=$REGION --project=$PROJECT_ID --quiet 2>$null

gcloud scheduler jobs create http pulse-autonomous-all `
    --location=$REGION `
    --schedule="0 0 * * *" `
    --uri="$FUNCTION_URL`?region=IN&maxTopics=15" `
    --http-method=GET `
    --oidc-service-account-email=$SA_EMAIL `
    --oidc-token-audience=$FUNCTION_URL `
    --time-zone="Asia/Kolkata" `
    --attempt-deadline=540s `
    --project=$PROJECT_ID 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "     ✅ Created" -ForegroundColor Green
} else {
    Write-Host "     ❌ Failed" -ForegroundColor Red
}
Write-Host ""

# Synthesizer job
Write-Host "⏰ Creating synthesizer job..." -ForegroundColor Yellow
$SYNTH_URL = gcloud functions describe synthesize-clusters --gen2 --region $REGION --format="value(url)" 2>$null

if ($SYNTH_URL) {
    gcloud functions add-invoker-policy-binding synthesize-clusters `
        --region=$REGION `
        --member="serviceAccount:$SA_EMAIL" `
        --project=$PROJECT_ID 2>$null
    
    gcloud scheduler jobs delete pulse-synthesize --location=$REGION --project=$PROJECT_ID --quiet 2>$null
    
    gcloud scheduler jobs create http pulse-synthesize `
        --location=$REGION `
        --schedule="0 */4 * * *" `
        --uri="$SYNTH_URL`?limit=30&region=IN" `
        --http-method=GET `
        --oidc-service-account-email=$SA_EMAIL `
        --oidc-token-audience=$SYNTH_URL `
        --time-zone="Asia/Kolkata" `
        --attempt-deadline=540s `
        --project=$PROJECT_ID 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Synthesizer scheduled (every 4 hours)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Autonomous scheduler setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 How it works:" -ForegroundColor Cyan
Write-Host "  1. Gemini discovers trending topics autonomously (NO predefined lists)" -ForegroundColor Gray
Write-Host "  2. For each discovered topic, generates 3-5 human-style queries" -ForegroundColor Gray
Write-Host "  3. Searches Google CSE for each query" -ForegroundColor Gray
Write-Host "  4. Clusters sources into specific stories" -ForegroundColor Gray
Write-Host "  5. Synthesizer creates comprehensive 1500-2500 word articles" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Examples of what Gemini discovers:" -ForegroundColor Yellow
Write-Host "  Health: 'New Alzheimer's drug FDA approval', 'Dengue outbreak Mumbai'" -ForegroundColor Gray
Write-Host "  Tech: 'GPT-5 launch OpenAI', 'iPhone 17 announcement'" -ForegroundColor Gray
Write-Host "  Business: 'Nifty 50 crosses 25000', 'US Fed rate cut'" -ForegroundColor Gray
Write-Host "  Sports: 'India vs Australia final', 'IPL 2025 auction'" -ForegroundColor Gray
Write-Host ""
Write-Host "🧪 Test manually:" -ForegroundColor Cyan
Write-Host "  gcloud scheduler jobs run pulse-autonomous-health --location=$REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 View jobs:" -ForegroundColor Cyan
Write-Host "  https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID" -ForegroundColor Gray
Write-Host ""
