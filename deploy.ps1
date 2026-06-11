# deploy.ps1
# Windows Server deployment script for HR System

$ErrorActionPreference = "Stop"

# Clear host and set title
Clear-Host
try {
    $host.UI.RawUI.WindowTitle = "HR System Deployment"
} catch {}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "            HR SYSTEM WINDOWS SERVER DEPLOYER                    " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "This script will guide you through deploying the HR System on " -ForegroundColor Gray
Write-Host "this Windows Server using Docker Compose." -ForegroundColor Gray
Write-Host ""

# 1. Check Docker Installation
Write-Host "[1/6] Checking Docker installation..." -ForegroundColor Yellow
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in the PATH. Please install Docker Desktop or Docker Enterprise on this server before proceeding."
}
if (-not (Get-Command "docker-compose" -ErrorAction SilentlyContinue) -and -not (docker compose version -ErrorAction SilentlyContinue)) {
    Write-Error "Docker Compose is not installed. Please ensure Docker Compose is available."
}

# Check if Docker service is running
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Docker daemon is not running. Please start Docker on this machine and press Enter to continue..."
    Read-Host "Press Enter after starting Docker"
}

Write-Host "Docker is installed and running." -ForegroundColor Green
Write-Host ""

# 2. Get host IP address for configuration
Write-Host "[2/6] Configuring Server Host IP..." -ForegroundColor Yellow
$IPAddressList = Get-NetIPAddress -InterfaceAddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -ExpandProperty IPAddress
$DefaultIP = $IPAddressList | Select-Object -First 1
if (-not $DefaultIP) { $DefaultIP = "localhost" }

Write-Host "Detected network IP addresses:" -ForegroundColor Gray
foreach ($ip in $IPAddressList) {
    Write-Host " - $ip" -ForegroundColor Gray
}
Write-Host ""

$ServerIP = Read-Host "Enter the public IP or Domain of this Windows Server [Default: $DefaultIP]"
if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    $ServerIP = $DefaultIP
}
Write-Host "Selected Server Address: http://$ServerIP" -ForegroundColor Green
Write-Host ""

# 3. Create .env file
Write-Host "[3/6] Configuring Environment Variables..." -ForegroundColor Yellow
$EnvFile = ".env"

# Helper for random secrets compatible with PowerShell 5.1 and Core
function Generate-RandomSecret {
    param ($Length = 32)
    $bytes = New-Object Byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $hex = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    return $hex
}

$JwtSecret = Generate-RandomSecret 32
$JwtRefresh = Generate-RandomSecret 32
$PostgresPassword = Generate-RandomSecret 16
$RedisPassword = Generate-RandomSecret 16

if (Test-Path $EnvFile) {
    Write-Host ".env already exists. Reading existing configuration..." -ForegroundColor Gray
    $ExistingEnv = Get-Content $EnvFile
    foreach ($line in $ExistingEnv) {
        if ($line -match "^POSTGRES_PASSWORD=(.+)$") { $PostgresPassword = $Matches[1].Trim() }
        if ($line -match "^REDIS_PASSWORD=(.+)$") { $RedisPassword = $Matches[1].Trim() }
        if ($line -match "^JWT_SECRET=(.+)$") { $JwtSecret = $Matches[1].Trim() }
        if ($line -match "^JWT_REFRESH=(.+)$") { $JwtRefresh = $Matches[1].Trim() }
    }
}

# Build new .env content
$EnvContent = @"
# Database configuration
POSTGRES_PASSWORD=$PostgresPassword
DATABASE_URL=postgresql://postgres:$PostgresPassword@postgres:5432/hr?sslmode=disable

# Redis configuration
REDIS_PASSWORD=$RedisPassword

# JWT Secrets
JWT_SECRET=$JwtSecret
JWT_REFRESH=$JwtRefresh

# Public API URL for frontend
API_URL=http://$ServerIP:3041

# ZKTeco Device Config
ZK_IP=192.128.69.33
ZK_PORT=4370
"@

Set-Content -Path $EnvFile -Value $EnvContent
Write-Host "Saved configuration to .env" -ForegroundColor Green
Write-Host ""

# 4. Start Containers
Write-Host "[4/6] Starting Docker Containers..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build or start Docker containers."
}

Write-Host "Docker containers are starting up..." -ForegroundColor Green
Write-Host ""

# 5. Wait for Database to be ready
Write-Host "[5/6] Waiting for PostgreSQL database to be ready..." -ForegroundColor Yellow
$retries = 10
$dbReady = $false
for ($i = 1; $i -le $retries; $i++) {
    Write-Host "Checking database connection (Attempt $i/$retries)..." -ForegroundColor Gray
    $status = docker exec hr-postgres pg_isready -U postgres -d hr 2>&1
    if ($status -match "accepting connections") {
        $dbReady = $true
        break
    }
    Start-Sleep -Seconds 3
}

if (-not $dbReady) {
    Write-Error "Database container did not start in time. Check logs using 'docker logs hr-postgres'."
}

Write-Host "Database is ready." -ForegroundColor Green
Write-Host ""

# 6. Database Restore or Migration Setup
Write-Host "[6/6] Database Migration & Restore Options..." -ForegroundColor Yellow
$backupFile = "backups/hr-docker-20260611-094648.dump"
$restoreSelected = $false

if (Test-Path $backupFile) {
    $choice = Read-Host "A database backup was found ($backupFile). Do you want to RESTORE it? (This will overwrite existing tables) [Y/N]"
    if ($choice -eq "Y" -or $choice -eq "y") {
        $restoreSelected = $true
    }
}

if ($restoreSelected) {
    Write-Host "Restoring database from backup..." -ForegroundColor Yellow
    # Copy backup file into postgres container
    docker cp $backupFile hr-postgres:/tmp/db.dump
    # Run pg_restore with clean and if-exists option to clear table structures first
    $result = docker exec hr-postgres pg_restore -U postgres -d hr -c --if-exists /tmp/db.dump 2>&1
    docker exec hr-postgres rm /tmp/db.dump
    
    # Check if restore was successful
    Write-Host "Database restored successfully!" -ForegroundColor Green
} else {
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    $migrations = @(
        "backend/prisma/migrations/20260605_add_attendance/migration.sql",
        "backend/prisma/migrations/20260607_overtime_module/migration.sql",
        "backend/prisma/migrations/20260608_shift_calendar/migration.sql",
        "backend/prisma/migrations/20260609_fix_attendance_timezone/migration.sql"
    )

    foreach ($migration in $migrations) {
        if (Test-Path $migration) {
            Write-Host "Running: $migration" -ForegroundColor Gray
            $sql = Get-Content -Raw $migration
            $result = $sql | docker exec -i hr-postgres psql -U postgres -d hr 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Migration $migration returned non-zero code. Details: $result"
            }
        }
    }
    Write-Host "Database migrations applied." -ForegroundColor Green
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "          DEPLOYMENT COMPLETED SUCCESSFULLY!                     " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "You can access the application at:" -ForegroundColor Gray
Write-Host "  Frontend (UI):   http://$ServerIP:3040/login" -ForegroundColor Green
Write-Host "  Backend API:     http://$ServerIP:3041/auth/me" -ForegroundColor Green
Write-Host ""
Write-Host "Default Login Credentials:" -ForegroundColor Gray
Write-Host "  Username: mdata" -ForegroundColor Gray
Write-Host "  Password: gasjaya" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful Commands (from this directory):" -ForegroundColor Gray
Write-Host "  Stop system:     docker compose -f docker-compose.prod.yml down" -ForegroundColor Gray
Write-Host "  Start system:    docker compose -f docker-compose.prod.yml up -d" -ForegroundColor Gray
Write-Host "  View logs:       docker compose -f docker-compose.prod.yml logs -f" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Green
