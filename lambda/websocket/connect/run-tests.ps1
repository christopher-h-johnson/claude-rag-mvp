# PowerShell script to run tests
Write-Host "Running WebSocket Connect Handler Tests..." -ForegroundColor Cyan

# Set execution policy for this session
$env:NODE_OPTIONS = "--experimental-vm-modules"

# Run tests
& node_modules/.bin/jest --verbose --no-coverage

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nTests passed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nTests failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}
