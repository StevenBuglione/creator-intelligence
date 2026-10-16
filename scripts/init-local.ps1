param(
    [Parameter(Mandatory=$true)][ValidatePattern('^UC[\w-]{22}$')][string]$OwnedChannelId,
    [Parameter(Mandatory=$true)][ValidatePattern('^\d+$')][string]$GoogleProjectNumber
)
$ErrorActionPreference='Stop' 
$secretRoot=if($env:CI_SECRET_DIR){[IO.Path]::GetFullPath($env:CI_SECRET_DIR)}else{Join-Path $env:USERPROFILE '.creator-intelligence/secrets'}
New-Item -ItemType Directory -Force -Path $secretRoot | Out-Null
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls $secretRoot /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0) { throw 'Could not protect secrets directory' }
$envPath=Join-Path $secretRoot 'local.env'
if(Test-Path -LiteralPath $envPath) { Write-Output 'Existing local environment preserved.'; exit 0 }
function New-RandomValue { [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
$dbPassword=(New-RandomValue).Replace('+','A').Replace('/','B').TrimEnd('=')
$values=[ordered]@{
    NODE_ENV='development'; APP_MODE='live'; APP_ORIGIN='http://localhost:4310'; API_ORIGIN='http://localhost:4311';
    DATABASE_URL="postgresql://creator:${dbPassword}@127.0.0.1:6437/creator_intelligence"; REDIS_URL='redis://127.0.0.1:6438';
    DB_PASSWORD=$dbPassword; APP_ENCRYPTION_KEY=(New-RandomValue); MCP_TOKEN=(New-RandomValue); WORKER_TOKEN=(New-RandomValue);
    OWNER_PASSWORD=(New-RandomValue); GOOGLE_PROJECT_NUMBER=$GoogleProjectNumber; OWNED_CHANNEL_ID=$OwnedChannelId;
    GOOGLE_OAUTH_REDIRECT_URI='http://localhost:4311/api/v1/auth/google/callback'; CI_SECRET_DIR=$secretRoot.Replace('\','/'); CI_ENV_FILE=$envPath.Replace('\','/')
}
[IO.File]::WriteAllLines($envPath,@($values.GetEnumerator() | ForEach-Object { $_.Key+'='+$_.Value }))
Write-Output 'Created protected local environment. No secret values were printed.'
