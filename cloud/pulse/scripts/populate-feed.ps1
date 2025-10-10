# Populate Pulse Feed with Multiple Topics
# This script runs Stage A for multiple topics, then Stage B to synthesize all

Write-Host "🚀 Populating Pulse Feed with Health News (India-First)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Health topics (broad keywords - AI will generate human-style trending queries)
$healthTopics = @(
    "diabetes",
    "mental health",
    "heart disease",
    "nutrition",
    "fitness",
    "yoga",
    "vaccination",
    "maternal health",
    "chronic diseases",
    "preventive healthcare"
)

Write-Host "📚 Stage A: Collecting sources for $($healthTopics.Count) health topics..." -ForegroundColor Yellow
Write-Host ""

# Get function URLs and auth
$URL_A = gcloud functions describe research-sources --gen2 --region us-central1 --format="value(url)" 2>$null
$URL_B = gcloud functions describe synthesize-clusters --gen2 --region us-central1 --format="value(url)" 2>$null
$TOKEN = gcloud auth print-identity-token 2>$null

if (-not $URL_A -or -not $URL_B -or -not $TOKEN) {
    Write-Host "❌ Error: Functions not deployed or auth failed" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
}

$successCount = 0
$failCount = 0

# Run Stage A for each topic
foreach ($topic in $healthTopics) {
    Write-Host "  🔍 Researching: $topic" -ForegroundColor Gray
    $encodedTopic = [System.Web.HttpUtility]::UrlEncode($topic)
    $url = "$URL_A`?topic=$encodedTopic&category=health&region=IN&maxQueries=4&perQuery=8"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -TimeoutSec 300
        Write-Host "    ✅ $($response.clusters) clusters created" -ForegroundColor Green
        $successCount++
        Start-Sleep -Seconds 2  # Rate limiting
    } catch {
        Write-Host "    ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "📊 Stage A Summary:" -ForegroundColor Yellow
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""

# Wait before Stage B
Write-Host "⏳ Waiting 5 seconds before synthesizing..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Run Stage B to synthesize all collected clusters
Write-Host ""
Write-Host "✍️  Stage B: Synthesizing all clusters into news articles..." -ForegroundColor Green
$urlB = "$URL_B`?limit=25&category=health&region=IN"

try {
    $responseB = Invoke-RestMethod -Uri $urlB -Headers $headers -Method Get -TimeoutSec 600
    Write-Host "  ✅ Synthesized: $($responseB.synthesized) articles" -ForegroundColor Green
    Write-Host "  ❌ Failed: $($responseB.failed)" -ForegroundColor $(if ($responseB.failed -gt 0) { "Yellow" } else { "Gray" })
} catch {
    Write-Host "  ❌ Stage B Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Feed Population Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 View in Frontend:" -ForegroundColor Cyan
Write-Host "  1. Run: npm run dev" -ForegroundColor Gray
Write-Host "  2. Navigate to: http://localhost:5173/pulse" -ForegroundColor Gray
Write-Host ""
Write-Host "🔗 View in Firestore:" -ForegroundColor Cyan
Write-Host "  https://console.firebase.google.com/project/ojas-ai/firestore/databases/-default-/data/~2Fpulse_articles" -ForegroundColor Gray
Write-Host ""
