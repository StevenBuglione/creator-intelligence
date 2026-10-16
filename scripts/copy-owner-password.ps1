$ErrorActionPreference='Stop'
$secretRoot=if($env:CI_SECRET_DIR){[IO.Path]::GetFullPath($env:CI_SECRET_DIR)}else{Join-Path $env:USERPROFILE '.creator-intelligence/secrets'}
$secretFile=Join-Path $secretRoot 'local.env'
$line=[IO.File]::ReadAllLines($secretFile) | Where-Object { $_.StartsWith('OWNER_PASSWORD=') }
if(-not $line) {throw 'Run init-local.ps1 first.'}
Set-Clipboard -Value $line.Substring('OWNER_PASSWORD='.Length)
Write-Output 'Owner password copied. Paste it into the local Creator Intelligence login. Clear your clipboard after signing in.'
