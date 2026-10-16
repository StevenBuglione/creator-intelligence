$ErrorActionPreference='Stop'
$secretRoot=if($env:CI_SECRET_DIR){[IO.Path]::GetFullPath($env:CI_SECRET_DIR)}else{Join-Path $env:USERPROFILE '.creator-intelligence/secrets'}
$secretFile=Join-Path $secretRoot 'local.env'
foreach($line in [IO.File]::ReadAllLines($secretFile)) {
  if($line.StartsWith('MCP_TOKEN=')) {$env:MCP_TOKEN=$line.Substring('MCP_TOKEN='.Length)}
}
if(-not $env:MCP_TOKEN){throw 'MCP token missing. Run init-local.ps1.'}
$root=Split-Path $PSScriptRoot -Parent
$nodeExe=(Get-Command node -ErrorAction Stop).Source
$env:CI_API_INTERNAL='http://localhost:4311'
try {& $nodeExe (Join-Path $root 'dist/apps/mcp/src/main.js');exit $LASTEXITCODE} finally {$env:MCP_TOKEN=$null}
