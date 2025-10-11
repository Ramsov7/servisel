param(
    [string]$ImageName = 'servisel-scraper:local',
    [string]$SupabaseUrl = '',
    [string]$SupabaseKey = ''
)

# Build image
Set-Location -Path (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)
Set-Location -Path ..
docker build -t $ImageName .

# Run container (example)
$envArgs = @()
if ($SupabaseUrl) { $envArgs += "-e SUPABASE_URL=$SupabaseUrl" }
if ($SupabaseKey) { $envArgs += "-e SUPABASE_SERVICE_ROLE=$SupabaseKey" }

Write-Host "Running container (image: $ImageName)"
docker run --rm $envArgs $ImageName $args
