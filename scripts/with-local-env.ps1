$Command=@($args)
$ErrorActionPreference='Stop'
$secretRoot=if($env:CI_SECRET_DIR){[IO.Path]::GetFullPath($env:CI_SECRET_DIR)}else{Join-Path $env:USERPROFILE '.creator-intelligence/secrets'}
foreach($line in [IO.File]::ReadAllLines((Join-Path $secretRoot 'local.env'))) {
    if($line -and -not $line.StartsWith('#')) { $parts=$line.Split('=',2); [Environment]::SetEnvironmentVariable($parts[0],$parts[1],'Process') }
}
$keyPath=Join-Path $secretRoot 'youtube-api-key.dpapi'
if(Test-Path -LiteralPath $keyPath) {
    $secure=ConvertTo-SecureString ([IO.File]::ReadAllText($keyPath))
    $env:YOUTUBE_DATA_API_KEY=[Net.NetworkCredential]::new('', $secure).Password
}
if(-not $Command.Count) { throw 'A command is required' }
$exe=$Command[0]; $arguments=@($Command | Select-Object -Skip 1)
try { & $exe @arguments; exit $LASTEXITCODE } finally { $env:YOUTUBE_DATA_API_KEY=$null }
