# Ojas Pulse - Complete Deployment with Cloud Scheduler
# Generates 500 articles/day in 4 scheduled batches

Write-Host "🚀 Ojas Pulse - Complete Deployment Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Configuration
$PROJECT_ID = "ojas-ai"
$REGION = "us-central1"
$FUNCTION_NAME = "generateArticles"
$GEMINI_API_KEY = "AIzaSyCgpMLX4VzKFGpzb12_kvo7cSSiETsMh-4"
$GOOGLE_SEARCH_API_KEY = "AIzaSyBl0pHldOtJr2l0VmgLQpcWelQ9oJ8--E0"
$GOOGLE_SEARCH_ENGINE_ID = "748584bebb02646c9"

Write-Host "`n📦 Step 1: Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n🔨 Step 2: Building TypeScript..." -ForegroundColor Yellow
npm run build

Write-Host "`n☁️  Step 3: Deploying Cloud Function..." -ForegroundColor Yellow
gcloud functions deploy $FUNCTION_NAME `
  --gen2 `
  --region=$REGION `
  --runtime=nodejs20 `
  --source=. `
  --entry-point=generateArticles `
  --trigger-http `
  --no-allow-unauthenticated `
  --timeout=540s `
  --memory=4GB `
  --max-instances=10 `
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY,GOOGLE_SEARCH_API_KEY=$GOOGLE_SEARCH_API_KEY,GOOGLE_SEARCH_ENGINE_ID=$GOOGLE_SEARCH_ENGINE_ID" `
  --quiet

Write-Host "✅ Function deployed successfully!" -ForegroundColor Green

# Get function URL
$FUNCTION_URL = (gcloud functions describe $FUNCTION_NAME --region=$REGION --gen2 --format="value(serviceConfig.uri)")
Write-Host "📍 Function URL: $FUNCTION_URL" -ForegroundColor Cyan

Write-Host "`n⏰ Step 4: Creating Cloud Scheduler Jobs..." -ForegroundColor Yellow

# Delete existing jobs if they exist
gcloud scheduler jobs delete pulse-morning --location=$REGION --quiet 2>$null
gcloud scheduler jobs delete pulse-afternoon --location=$REGION --quiet 2>$null
gcloud scheduler jobs delete pulse-evening --location=$REGION --quiet 2>$null
gcloud scheduler jobs delete pulse-night --location=$REGION --quiet 2>$null

# Morning batch: 6:00 AM IST (00:30 UTC) - 125 articles
Write-Host "📅 Creating Morning schedule (6:00 AM IST)..." -ForegroundColor White
gcloud scheduler jobs create http pulse-morning `
  --location=$REGION `
  --schedule="30 0 * * *" `
  --time-zone="Asia/Kolkata" `
  --uri="$FUNCTION_URL`?perCategory=21&stage=all" `
  --http-method=GET `
  --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" `
  --oidc-token-audience="$FUNCTION_URL" `
  --attempt-deadline=540s `
  --description="Morning batch: 125 articles (21 per category × 6 categories)"

# Afternoon batch: 12:00 PM IST (06:30 UTC) - 125 articles
Write-Host "📅 Creating Afternoon schedule (12:00 PM IST)..." -ForegroundColor White
gcloud scheduler jobs create http pulse-afternoon `
  --location=$REGION `
  --schedule="30 6 * * *" `
  --time-zone="Asia/Kolkata" `
  --uri="$FUNCTION_URL`?perCategory=21&stage=all" `
  --http-method=GET `
  --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" `
  --oidc-token-audience="$FUNCTION_URL" `
  --attempt-deadline=540s `
  --description="Afternoon batch: 125 articles"

# Evening batch: 6:00 PM IST (12:30 UTC) - 125 articles
Write-Host "📅 Creating Evening schedule (6:00 PM IST)..." -ForegroundColor White
gcloud scheduler jobs create http pulse-evening `
  --location=$REGION `
  --schedule="30 12 * * *" `
  --time-zone="Asia/Kolkata" `
  --uri="$FUNCTION_URL`?perCategory=21&stage=all" `
  --http-method=GET `
  --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" `
  --oidc-token-audience="$FUNCTION_URL" `
  --attempt-deadline=540s `
  --description="Evening batch: 125 articles"

# Night batch: 12:00 AM IST (18:30 UTC) - 125 articles
Write-Host "📅 Creating Night schedule (12:00 AM IST)..." -ForegroundColor White
gcloud scheduler jobs create http pulse-night `
  --location=$REGION `
  --schedule="30 18 * * *" `
  --time-zone="Asia/Kolkata" `
  --uri="$FUNCTION_URL`?perCategory=21&stage=all" `
  --http-method=GET `
  --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" `
  --oidc-token-audience="$FUNCTION_URL" `
  --attempt-deadline=540s `
  --description="Night batch: 125 articles"

Write-Host "`n✅ All Cloud Scheduler jobs created!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Schedule Summary:" -ForegroundColor Cyan
Write-Host "  🌅 Morning (6:00 AM):    125 articles" -ForegroundColor White
Write-Host "  ☀️  Afternoon (12:00 PM): 125 articles" -ForegroundColor White
Write-Host "  🌆 Evening (6:00 PM):    125 articles" -ForegroundColor White
Write-Host "  🌙 Night (12:00 AM):     125 articles" -ForegroundColor White
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "  📈 Total per day:        500 articles" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Test manually:" -ForegroundColor Yellow
Write-Host "  `$token = gcloud auth print-identity-token" -ForegroundColor Gray
Write-Host "  Invoke-RestMethod -Uri `"$FUNCTION_URL`?perCategory=5&stage=all`" -Headers @{Authorization=`"Bearer `$token`"}" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
