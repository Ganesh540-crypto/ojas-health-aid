# Quick script to recreate schedulers only

$REGION = "us-central1"
$FUNCTION_URL = "https://generatearticles-mhgzcjesmq-uc.a.run.app"

Write-Host "⏰ Creating Cloud Scheduler Jobs..." -ForegroundColor Yellow

# Morning batch
gcloud scheduler jobs create http pulse-morning --location=$REGION --schedule="30 0 * * *" --time-zone="Asia/Kolkata" --uri="$FUNCTION_URL/?perCategory=21&stage=all" --http-method=GET --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" --oidc-token-audience="$FUNCTION_URL" --attempt-deadline=540s --description="Morning batch: 125 articles"

# Afternoon batch
gcloud scheduler jobs create http pulse-afternoon --location=$REGION --schedule="30 6 * * *" --time-zone="Asia/Kolkata" --uri="$FUNCTION_URL/?perCategory=21&stage=all" --http-method=GET --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" --oidc-token-audience="$FUNCTION_URL" --attempt-deadline=540s --description="Afternoon batch: 125 articles"

# Evening batch
gcloud scheduler jobs create http pulse-evening --location=$REGION --schedule="30 12 * * *" --time-zone="Asia/Kolkata" --uri="$FUNCTION_URL/?perCategory=21&stage=all" --http-method=GET --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" --oidc-token-audience="$FUNCTION_URL" --attempt-deadline=540s --description="Evening batch: 125 articles"

# Night batch
gcloud scheduler jobs create http pulse-night --location=$REGION --schedule="30 18 * * *" --time-zone="Asia/Kolkata" --uri="$FUNCTION_URL/?perCategory=21&stage=all" --http-method=GET --oidc-service-account-email="pulse-scheduler@ojas-ai.iam.gserviceaccount.com" --oidc-token-audience="$FUNCTION_URL" --attempt-deadline=540s --description="Night batch: 125 articles"

Write-Host "✅ All schedulers created!" -ForegroundColor Green
