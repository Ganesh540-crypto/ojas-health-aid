$file = "c:\Users\ganes\Downloads\Ojas-ai\src\components\Chat\ChatContainer.tsx"
$content = Get-Content $file -Raw

# Fix the thinking mode from 'thinking' to 'analyzing' for health intake
$content = $content -replace "setThinkingMode\('thinking'\);[\r\n\s]+setThinkingLabel\('Preparing health questions'\);", "setThinkingMode('analyzing');`r`n        setThinkingLabel('Preparing health questions');"

Set-Content $file $content -NoNewline
Write-Host "Fixed health intake animation transition"
