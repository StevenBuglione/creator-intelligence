param([Parameter(Mandatory=$true)][string]$Project)
$ErrorActionPreference = 'Stop'
$secretRoot = if($env:CI_SECRET_DIR){[IO.Path]::GetFullPath($env:CI_SECRET_DIR)}else{Join-Path $env:USERPROFILE '.creator-intelligence/secrets'}
New-Item -ItemType Directory -Force -Path $secretRoot | Out-Null
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls $secretRoot /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to restrict the secret directory' }
$keyName = 'Creator Intelligence public read data'
$existingJson = & gcloud services api-keys list --project=$Project --format=json 2>$null
if ($LASTEXITCODE -ne 0) { throw 'API key inventory failed' }
$matching = @($existingJson | ConvertFrom-Json | Where-Object displayName -eq $keyName)
if ($matching.Count -gt 1) { throw 'Ambiguous existing API key; inspect metadata before proceeding' }
if ($matching.Count -eq 0) {
    # gcloud may include keyString in its operation-completion STDERR even when
    # --format filters STDOUT. Capture BOTH streams and never display either.
    $creationOutput = & gcloud services api-keys create --project=$Project --key-id=creator-intelligence-public-v2 --display-name=$keyName --api-target=service=youtube.googleapis.com --format=json 2>&1
    $creationExit = $LASTEXITCODE
    $creationOutput = $null
    if ($creationExit -ne 0) { throw 'Key creation failed or uncertain; inspect inventory before retrying' }
    $keyList = & gcloud services api-keys list --project=$Project --format=json 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Key inventory after creation failed' }
    $matching = @($keyList | ConvertFrom-Json | Where-Object displayName -eq $keyName)
    if ($matching.Count -ne 1) { throw 'Created key identity is ambiguous' }
    $resource = $matching[0].name
} else { $resource = $matching[0].name }
$resource = $resource.Trim()
$metadata = & gcloud services api-keys describe $resource --project=$Project --format=json 2>$null | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Key metadata verification failed' }
$targets = @($metadata.restrictions.apiTargets)
if ($targets.Count -ne 1 -or $targets[0].service -ne 'youtube.googleapis.com') { throw 'Key is not restricted to YouTube Data API' }
$keyValue = & gcloud services api-keys get-key-string $resource --project=$Project '--format=value(keyString)' 2>$null
if ($LASTEXITCODE -ne 0 -or -not $keyValue) { throw 'Key retrieval failed' }
try {
    $secure = ConvertTo-SecureString -String $keyValue.Trim() -AsPlainText -Force
    $encrypted = ConvertFrom-SecureString -SecureString $secure
    [IO.File]::WriteAllText((Join-Path $secretRoot 'youtube-api-key.dpapi'), $encrypted)
} finally { $keyValue = $null; $secure = $null; $encrypted = $null }
$receipt = @{resource=$resource; project=$Project; service='youtube.googleapis.com'; storage='Windows current-user DPAPI'; applicationRestriction='none: dynamic local egress; key remains server-side'; verifiedAt=[DateTime]::UtcNow.ToString('o')}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $secretRoot 'youtube-api-key-metadata.json')
$receipt | ConvertTo-Json
