# Pulse V2 Pipeline Trigger Script
# Usage: .\trigger-pulse.ps1 -Stage A|B|All -Topic "your topic"

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("A", "B", "All")]
    [string]$Stage = "All",
    
    [Parameter(Mandatory=$false)]
    [string]$Topic = "health India latest",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("health", "technology", "science", "entertainment")]
    [string]$Category = "health",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("IN", "US", "GLOBAL")]
    [string]$Region = "IN",
    
    [Parameter(Mandatory=$false)]
    [int]$MaxQueries = 5,
    
    [Parameter(Mandatory=$false)]
    [int]$PerQuery = 10,
    
    [Parameter(Mandatory=$false)]
    [int]$SynthesizeLimit = 10
)

Write-Host "🔍 Pulse V2 Pipeline Trigger" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Get function URLs
Write-Host "📡 Getting function URLs..." -ForegroundColor Yellow
$URL_A = gcloud functions describe research-sources --gen2 --region us-central1 --format="value(url)" 2>$null
$URL_B = gcloud functions describe synthesize-clusters --gen2 --region us-central1 --format="value(url)" 2>$null

if (-not $URL_A -or -not $URL_B) {
    Write-Host "❌ Error: Could not retrieve function URLs. Make sure functions are deployed." -ForegroundColor Red
    exit 1
}

# Get auth token
Write-Host "🔐 Getting authentication token..." -ForegroundColor Yellow
$TOKEN = gcloud auth print-identity-token 2>$null

if (-not $TOKEN) {
    Write-Host "❌ Error: Could not get auth token. Run 'gcloud auth login' first." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# Stage A: Research & Categorize
if ($Stage -eq "A" -or $Stage -eq "All") {
    Write-Host ""
    Write-Host "📚 Stage A: Research & Categorize Sources" -ForegroundColor Green
    Write-Host "  Topic: $Topic" -ForegroundColor Gray
    Write-Host "  Category: $Category" -ForegroundColor Gray
    Write-Host "  Region: $Region" -ForegroundColor Gray
    Write-Host "  Queries: $MaxQueries × $PerQuery results" -ForegroundColor Gray
    Write-Host ""
    
    $encodedTopic = [System.Web.HttpUtility]::UrlEncode($Topic)
    $urlStageA = "$URL_A`?topic=$encodedTopic&category=$Category&region=$Region&maxQueries=$MaxQueries&perQuery=$PerQuery"
    
    try {
        $responseA = Invoke-RestMethod -Uri $urlStageA -Headers $headers -Method Get
        Write-Host "✅ Stage A Complete!" -ForegroundColor Green
        Write-Host "  Clusters created: $($responseA.clusters)" -ForegroundColor Cyan
        Write-Host "  Queries used: $($responseA.queries.Count)" -ForegroundColor Cyan
        if ($responseA.queries) {
            Write-Host "  Sample queries:" -ForegroundColor Gray
            $responseA.queries | Select-Object -First 3 | ForEach-Object { Write-Host "    - $_" -ForegroundColor Gray }
        }
    } catch {
        Write-Host "❌ Stage A Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($Stage -eq "All") {
            Write-Host "⚠️  Skipping Stage B due to Stage A failure" -ForegroundColor Yellow
            exit 1
        }
    }
}

# Stage B: Synthesize News
if ($Stage -eq "B" -or $Stage -eq "All") {
    if ($Stage -eq "All") {
        Write-Host ""
        Write-Host "⏳ Waiting 3 seconds before Stage B..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
    
    Write-Host ""
    Write-Host "✍️  Stage B: Synthesize News Articles" -ForegroundColor Green
    Write-Host "  Category: $Category" -ForegroundColor Gray
    Write-Host "  Region: $Region" -ForegroundColor Gray
    Write-Host "  Limit: $SynthesizeLimit clusters" -ForegroundColor Gray
    Write-Host ""
    
    $urlStageB = "$URL_B`?limit=$SynthesizeLimit&category=$Category&region=$Region"
    
    try {
        $responseB = Invoke-RestMethod -Uri $urlStageB -Headers $headers -Method Get
        Write-Host "✅ Stage B Complete!" -ForegroundColor Green
        Write-Host "  Articles synthesized: $($responseB.synthesized)" -ForegroundColor Cyan
        Write-Host "  Failed: $($responseB.failed)" -ForegroundColor $(if ($responseB.failed -gt 0) { "Yellow" } else { "Cyan" })
    } catch {
        Write-Host "❌ Stage B Failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🎉 Pipeline Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Check Firestore: https://console.firebase.google.com/project/ojas-ai/firestore" -ForegroundColor Gray
Write-Host "  2. View articles in collections: pulse_sources, pulse_articles" -ForegroundColor Gray
Write-Host "  3. Test frontend: npm run dev → /pulse" -ForegroundColor Gray
Write-Host ""
