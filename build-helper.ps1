$ErrorActionPreference = 'Stop'

$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $csc -PathType Leaf)) {
    throw ("Required .NET Framework C# compiler not found: " + $csc)
}

$themeDir = Join-Path $PSScriptRoot 'theme'
$source = Join-Path $themeDir 'WindowTransitions.cs'
$outExe = Join-Path $themeDir 'WindowTransitions.exe'
$outSha = Join-Path $themeDir 'WindowTransitions.sha256'

& $csc /nologo /target:winexe /optimize+ ("/out:" + $outExe) $source
if ($LASTEXITCODE -ne 0) {
    throw ("Compilation of WindowTransitions.cs failed with exit code " + $LASTEXITCODE)
}

$sha = (Get-FileHash -LiteralPath $outExe -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($outSha, ($sha + "`n"), [Text.UTF8Encoding]::new($false))
Write-Output ("Built " + $outExe + " (SHA-256: " + $sha + ")")
