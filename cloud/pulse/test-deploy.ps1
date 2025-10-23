$token = gcloud auth print-identity-token
$headers = @{
    Authorization = "Bearer $token"
}
$url = "https://generatearticles-mhgzcjesmq-uc.a.run.app?perCategory=1&stage=all"

Write-Host "Testing article generation with new format..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

$response = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
$response | ConvertTo-Json -Depth 10
