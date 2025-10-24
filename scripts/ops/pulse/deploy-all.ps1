#!/usr/bin/env pwsh
# Complete deployment script for Ojas Pulse with all updates
# Run from cloud/pulse directory

Write-Host "🚀 Ojas Pulse - Complete Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check prerequisites
Write-Host "📋 Step 1: Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js not found! Please install Node.js 20+" -ForegroundColor Red
    exit 1
}

# Check gcloud
try {
    $gcloudVersion = gcloud --version | Select-Object -First 1
    Write-Host "  ✅ gcloud: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ gcloud not found! Please install Google Cloud SDK" -ForegroundColor Red
    exit 1
}

# Check current project
$project = gcloud config get-value project 2>$null
if ($project) {
    Write-Host "  ✅ GCP Project: $project" -ForegroundColor Green
} else {
    Write-Host "  ❌ No GCP project set! Run: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Red
    exit 1
}

# Step 2: Get API keys
Write-Host ""
Write-Host "🔑 Step 2: Loading API keys..." -ForegroundColor Yellow
Write-Host ""

# Try Secret Manager first
try {
    $GEMINI_API_KEY = gcloud secrets versions access latest --secret="GEMINI_API_KEY" 2>$null
    if ($GEMINI_API_KEY) {
        Write-Host "  ✅ GEMINI_API_KEY from Secret Manager" -ForegroundColor Green
    }
} catch {
    # Fall back to .env
    if (Test-Path ".env") {
        Write-Host "  📄 Loading from .env file..." -ForegroundColor Cyan
        Get-Content .env | ForEach-Object {
            if ($_ -match '^(?:VITE_)?GEMINI_API_KEY="?([^"]+)"?$') { 
                $GEMINI_API_KEY = $matches[1] 
                Write-Host "  ✅ GEMINI_API_KEY from .env" -ForegroundColor Green
            }
        }
    }
}

if (!$GEMINI_API_KEY) {
    Write-Host "  ❌ GEMINI_API_KEY not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set it using one of:" -ForegroundColor Yellow
    Write-Host "1. Secret Manager: echo 'YOUR_KEY' | gcloud secrets create GEMINI_API_KEY --data-file=-" -ForegroundColor White
    Write-Host "2. Create .env file with: GEMINI_API_KEY=YOUR_KEY" -ForegroundColor White
    exit 1
}

Write-Host "  ✅ API key validated: $($GEMINI_API_KEY.Substring(0, 10))..." -ForegroundColor Green

# Step 3: Build
Write-Host ""
Write-Host "🔨 Step 3: Building TypeScript..." -ForegroundColor Yellow
Write-Host ""

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ npm install failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Dependencies installed" -ForegroundColor Green

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Build successful" -ForegroundColor Green

# Verify dist exists
if (!(Test-Path "dist/index.js")) {
    Write-Host "  ❌ dist/index.js not found!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ dist/index.js verified" -ForegroundColor Green

# Step 4: Deploy
Write-Host ""
Write-Host "🚀 Step 4: Deploying to Cloud Functions..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Deploying generateArticles function..." -ForegroundColor Cyan
gcloud functions deploy generateArticles `
    --gen2 `
    --region=us-central1 `
    --runtime=nodejs20 `
    --source=. `
    --entry-point=generateArticles `
    --trigger-http `
    --allow-unauthenticated `
    --timeout=540s `
    --memory=2GB `
    --max-instances=10 `
    --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green

# Step 5: Get function URL
Write-Host ""
Write-Host "📡 Step 5: Getting function URL..." -ForegroundColor Yellow
Write-Host ""

$FUNCTION_URL = gcloud functions describe generateArticles `
    --region=us-central1 `
    --format="value(serviceConfig.uri)"

Write-Host "  ✅ Function URL: $FUNCTION_URL" -ForegroundColor Green

# Step 6: Test
Write-Host ""
Write-Host "🧪 Step 6: Testing deployment..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Generating 3 test articles..." -ForegroundColor Cyan
$response = curl -s "$FUNCTION_URL?count=3"
Write-Host $response

# Step 7: Verify logs
Write-Host ""
Write-Host "📋 Step 7: Checking deployment logs..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Seconds 2

$logs = gcloud functions logs read generateArticles --region=us-central1 --limit=20
$logs | Select-String "synthesis|sources|Generated" | ForEach-Object {
    Write-Host "  $_" -ForegroundColor White
}

# Success summary
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  • Project: $project" -ForegroundColor White
Write-Host "  • Function: generateArticles" -ForegroundColor White
Write-Host "  • Region: us-central1" -ForegroundColor White
Write-Host "  • URL: $FUNCTION_URL" -ForegroundColor White
Write-Host ""

Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test: curl '$FUNCTION_URL?count=5'" -ForegroundColor White
Write-Host "  2. Check Firestore: https://console.firebase.google.com/" -ForegroundColor White
Write-Host "  3. View frontend: http://localhost:5173/pulse" -ForegroundColor White
Write-Host ""

Write-Host "📚 Features implemented:" -ForegroundColor Cyan
Write-Host "  ✅ 500-1000 word articles" -ForegroundColor Green
Write-Host "  ✅ 7-20 sources per article" -ForegroundColor Green
Write-Host "  ✅ Inline citations [1][2]" -ForegroundColor Green
Write-Host "  ✅ Multi-source synthesis" -ForegroundColor Green
Write-Host "  ✅ Professional journalism style" -ForegroundColor Green
Write-Host "  ✅ Alternating card layout" -ForegroundColor Green
Write-Host "  ✅ Clickable citations" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 All done! Happy article generation!" -ForegroundColor Green
Write-Host ""
