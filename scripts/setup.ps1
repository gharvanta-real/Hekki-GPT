# MARIANO Setup Script for Windows
Write-Host "Setting up MARIANO..." -ForegroundColor Cyan

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python not found. Install Python 3.12+"
    exit 1
}

# Install Python deps
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
pip install -e . --quiet

# Setup .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env file. Add your GEMINI_API_KEY!" -ForegroundColor Yellow
} else {
    Write-Host ".env already exists." -ForegroundColor Green
}

# Build Rust engine
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Write-Host "Building Rust engine..." -ForegroundColor Yellow
    Push-Location nexus-engine
    cargo build --release 2>&1 | Out-Null
    Pop-Location
    Write-Host "Rust engine built." -ForegroundColor Green
} else {
    Write-Host "Cargo not found. Rust engine will be skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "MARIANO setup complete!" -ForegroundColor Green
Write-Host "Run: python main.py" -ForegroundColor Cyan
