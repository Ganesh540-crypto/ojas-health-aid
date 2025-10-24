#!/bin/bash
# Ojas Pulse - Complete Deployment with Cloud Scheduler
# Generates 500 articles/day in 4 scheduled batches

set -e

echo "🚀 Ojas Pulse - Complete Deployment Script"
echo "============================================"

# Configuration
PROJECT_ID="ojas-ai"
REGION="us-central1"
FUNCTION_NAME="generateArticles"
GEMINI_API_KEY="AIzaSyCgpMLX4VzKFGpzb12_kvo7cSSiETsMh-4"
GOOGLE_SEARCH_API_KEY="AIzaSyBl0pHldOtJr2l0VmgLQpcWelQ9oJ8--E0"
GOOGLE_SEARCH_ENGINE_ID="748584bebb02646c9"

echo "📦 Step 1: Installing dependencies..."
npm install

echo "🔨 Step 2: Building TypeScript..."
npm run build

echo "☁️  Step 3: Deploying Cloud Function..."
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --region=$REGION \
  --runtime=nodejs20 \
  --source=. \
  --entry-point=generateArticles \
  --trigger-http \
  --no-allow-unauthenticated \
  --timeout=540s \
  --memory=4GB \
  --max-instances=10 \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY,GOOGLE_SEARCH_API_KEY=$GOOGLE_SEARCH_API_KEY,GOOGLE_SEARCH_ENGINE_ID=$GOOGLE_SEARCH_ENGINE_ID" \
  --quiet

echo "✅ Function deployed successfully!"

# Get function URL
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --gen2 --format="value(serviceConfig.uri)")
echo "📍 Function URL: $FUNCTION_URL"

echo ""
echo "⏰ Step 4: Creating Cloud Scheduler Jobs..."

# Delete existing jobs if they exist
gcloud scheduler jobs delete pulse-morning --location=$REGION --quiet 2>/dev/null || true
gcloud scheduler jobs delete pulse-afternoon --location=$REGION --quiet 2>/dev/null || true
gcloud scheduler jobs delete pulse-evening --location=$REGION --quiet 2>/dev/null || true
gcloud scheduler jobs delete pulse-night --location=$REGION --quiet 2>/dev/null || true

# Morning batch: 6:00 AM IST (00:30 UTC) - 125 articles (25 per category)
echo "📅 Creating Morning schedule (6:00 AM IST)..."
gcloud scheduler jobs create http pulse-morning \
  --location=$REGION \
  --schedule="30 0 * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="$FUNCTION_URL?perCategory=21&stage=all" \
  --http-method=GET \
  --oidc-service-account-email="633298382795-compute@developer.gserviceaccount.com" \
  --attempt-deadline=540s \
  --description="Morning batch: 125 articles (21 per category × 6 categories)"

# Afternoon batch: 12:00 PM IST (06:30 UTC) - 125 articles
echo "📅 Creating Afternoon schedule (12:00 PM IST)..."
gcloud scheduler jobs create http pulse-afternoon \
  --location=$REGION \
  --schedule="30 6 * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="$FUNCTION_URL?perCategory=21&stage=all" \
  --http-method=GET \
  --oidc-service-account-email="633298382795-compute@developer.gserviceaccount.com" \
  --attempt-deadline=540s \
  --description="Afternoon batch: 125 articles"

# Evening batch: 6:00 PM IST (12:30 UTC) - 125 articles
echo "📅 Creating Evening schedule (6:00 PM IST)..."
gcloud scheduler jobs create http pulse-evening \
  --location=$REGION \
  --schedule="30 12 * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="$FUNCTION_URL?perCategory=21&stage=all" \
  --http-method=GET \
  --oidc-service-account-email="633298382795-compute@developer.gserviceaccount.com" \
  --attempt-deadline=540s \
  --description="Evening batch: 125 articles"

# Night batch: 12:00 AM IST (18:30 UTC) - 125 articles
echo "📅 Creating Night schedule (12:00 AM IST)..."
gcloud scheduler jobs create http pulse-night \
  --location=$REGION \
  --schedule="30 18 * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="$FUNCTION_URL?perCategory=21&stage=all" \
  --http-method=GET \
  --oidc-service-account-email="633298382795-compute@developer.gserviceaccount.com" \
  --attempt-deadline=540s \
  --description="Night batch: 125 articles"

echo ""
echo "✅ All Cloud Scheduler jobs created!"
echo ""
echo "📊 Schedule Summary:"
echo "  🌅 Morning (6:00 AM):    125 articles"
echo "  ☀️  Afternoon (12:00 PM): 125 articles"
echo "  🌆 Evening (6:00 PM):    125 articles"
echo "  🌙 Night (12:00 AM):     125 articles"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📈 Total per day:        500 articles"
echo ""
echo "🧪 Test manually:"
echo "  curl -H \"Authorization: Bearer \$(gcloud auth print-identity-token)\" \\"
echo "    \"$FUNCTION_URL?perCategory=5&stage=all\""
echo ""
echo "🎉 Deployment complete!"
