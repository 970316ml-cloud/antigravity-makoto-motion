param([switch]$Restore, [string]$InstallDir = '')
$ErrorActionPreference = 'Stop'

function Child-Path($parent, $leaf) {
    $resolved = [IO.Path]::GetFullPath((Join-Path $parent $leaf))
    if ([IO.Path]::GetDirectoryName($resolved) -ne $parent) { throw 'Unexpected maintenance path.' }
    return $resolved
}

function Normalize-DirPath([string]$dirPath) {
    return [IO.Path]::GetFullPath($dirPath).TrimEnd('\', '/')
}

function Test-ValidAntigravityDir([string]$dirPath) {
    if (!$dirPath) { return $false }
    $exePath = Join-Path $dirPath 'Antigravity.exe'
    $asarPath = Join-Path $dirPath 'resources\app.asar'
    return (Test-Path -LiteralPath $exePath -PathType Leaf) -and (Test-Path -LiteralPath $asarPath -PathType Leaf)
}

function Find-AntigravityDir([string]$explicit) {
    if ($explicit -and $explicit.Trim()) {
        $trimmed = $explicit.Trim()
        if (!(Test-ValidAntigravityDir $trimmed)) {
            throw ("Specified -InstallDir does not contain a valid Antigravity installation (missing Antigravity.exe or resources\app.asar): " + $trimmed)
        }
        return (Normalize-DirPath (Resolve-Path -LiteralPath $trimmed).Path)
    }

    $candidates = @()
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\antigravity') }
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'Antigravity') }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Antigravity') }

    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $found = New-Object 'System.Collections.Generic.List[string]'
    foreach ($dir in $candidates) {
        if (!(Test-ValidAntigravityDir $dir)) { continue }
        $resolved = Normalize-DirPath (Resolve-Path -LiteralPath $dir).Path
        if ($seen.Add($resolved)) { $found.Add($resolved) }
    }

    if ($found.Count -eq 0) {
        throw 'Could not locate Antigravity installation (Antigravity.exe / resources\app.asar). Pass -InstallDir "<path>" if installed in a custom directory.'
    }
    if ($found.Count -gt 1) {
        $listed = ($found | ForEach-Object { "  - $_" }) -join "`n"
        throw ("Multiple Antigravity installations were found. Specify the target explicitly with -InstallDir `"<path>`":`n" + $listed)
    }
    return $found[0]
}

function Find-Node([string]$chineseRoot) {
    $cfgPath = Join-Path $chineseRoot 'config.json'
    if (Test-Path -LiteralPath $cfgPath) {
        try {
            $cfgNode = (Get-Content -Raw -LiteralPath $cfgPath | ConvertFrom-Json).Node
            if ($cfgNode -and (Test-Path -LiteralPath $cfgNode)) { return $cfgNode }
        } catch {}
    }
    $cmd = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
    if ($cmd -and (Test-Path -LiteralPath $cmd)) { return $cmd }
    foreach ($p in @(
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
    )) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    throw 'Node.js (>=18) was not found. Install Node.js first (e.g. winget install OpenJS.NodeJS.LTS) and run this installer again.'
}

function Get-Sha256([string]$filePath) {
    return (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
}

$install = Find-AntigravityDir $InstallDir
$exe = Join-Path $install 'Antigravity.exe'
$archive = Join-Path $install 'resources\app.asar'
$managedChineseInstall = Normalize-DirPath (Join-Path $env:LOCALAPPDATA 'Programs\antigravity')
$chineseRoot = Join-Path $env:LOCALAPPDATA 'Programs\AntigravityChineseAuto'
$isChineseAuto = ($install -ieq $managedChineseInstall) -and
    (Test-Path -LiteralPath (Join-Path $chineseRoot 'maintain.cjs')) -and
    (Test-Path -LiteralPath (Join-Path $chineseRoot 'update-hook.cjs'))

if ($isChineseAuto) {
    $maintenance = Normalize-DirPath (Resolve-Path -LiteralPath $chineseRoot).Path
    $mutexName = 'Local\AntigravityChineseAutoRestore'
} else {
    $standaloneDir = Join-Path $env:LOCALAPPDATA 'Programs\AntigravityMakotoMotion'
    New-Item -ItemType Directory -Path $standaloneDir -Force | Out-Null
    $maintenance = Normalize-DirPath (Resolve-Path -LiteralPath $standaloneDir).Path
    $mutexName = 'Local\AntigravityMakotoMotion'
}

$node = Find-Node $chineseRoot
$token = [guid]::NewGuid().ToString('N')
$stage = Join-Path $maintenance ('.makoto-stage-' + $token)
$old = Join-Path $stage 'previous'
$txFile = Child-Path $maintenance 'transaction.json'
$mutex = New-Object Threading.Mutex($false, $mutexName)
$locked = $false
$reopen = $false
$cleanStage = $true
$txEntries = New-Object 'System.Collections.Generic.List[object]'
$moved = New-Object 'System.Collections.Generic.List[string]'
$placed = New-Object 'System.Collections.Generic.List[string]'

function Save-Transaction([string]$mode, [string]$action) {
    $payload = @{
        token = $token
        installDir = $install
        mode = $mode
        action = $action
        createdAt = (Get-Date).ToString('o')
        entries = @($txEntries.ToArray())
    } | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText($txFile, $payload, [Text.UTF8Encoding]::new($false))
}

function Commit-FileAtomically([string]$sourceFile, [string]$targetFile, [string]$stageOldCopy, [string]$expectedSrcSha, [string]$mode, [string]$action) {
    if (!(Test-Path -LiteralPath $targetFile -PathType Leaf)) {
        throw ("Expected existing target file before replacement: " + $targetFile)
    }
    $srcSha = Get-Sha256 $sourceFile
    if ($expectedSrcSha -and $srcSha -ne $expectedSrcSha) {
        throw ("Staged artifact SHA-256 mismatch for " + $sourceFile)
    }
    $origSha = Get-Sha256 $targetFile
    [IO.File]::Copy($targetFile, $stageOldCopy, $true)
    if ((Get-Sha256 $stageOldCopy) -ne $origSha) {
        throw ("Recovery backup SHA-256 verification failed for " + $stageOldCopy)
    }

    $targetDir = [IO.Path]::GetDirectoryName($targetFile)
    $leaf = [IO.Path]::GetFileName($targetFile)
    $sameVolTmp = Join-Path $targetDir (".makoto-$token-" + $leaf + '.tmp')
    $sameVolBak = Join-Path $targetDir (".makoto-$token-" + $leaf + '.bak')

    $entry = [ordered]@{
        target = $targetFile
        sameVolTmp = $sameVolTmp
        sameVolBak = $sameVolBak
        stageOld = $stageOldCopy
        origSha = $origSha
        newSha = $srcSha
        replaced = $false
    }
    $txEntries.Add($entry)
    Save-Transaction $mode $action

    [IO.File]::Copy($sourceFile, $sameVolTmp, $true)
    if ((Get-Sha256 $sameVolTmp) -ne $srcSha) {
        throw ("Same-volume temporary copy failed SHA-256 check: " + $sameVolTmp)
    }
    [IO.File]::Replace($sameVolTmp, $targetFile, $sameVolBak)
    $entry.replaced = $true
    Save-Transaction $mode $action

    if ((Get-Sha256 $targetFile) -ne $srcSha) {
        throw ("Committed target failed post-replace SHA-256 verification: " + $targetFile)
    }
}

function Get-Client {
    Get-CimInstance Win32_Process -Filter "Name='Antigravity.exe'" | Where-Object {
        $_.ExecutablePath -eq $exe -and $_.CommandLine -notmatch 'sidecar_sdk[/\\]|register_loader\.js|mcp_entry\.cjs(?=[\s"]|$)|(?:^|\s)--(?:sidecar|mcp[-_]entry)(?:=|\s|$)'
    }
}
function Check-Update {
    if (!$isChineseAuto) { return }
    $file = Join-Path $maintenance 'update-active.json'
    if (!(Test-Path -LiteralPath $file)) { return }
    $update = Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
    foreach ($owner in @($update.ownerPid, $update.installerPid) + @($update.installerPids)) {
        if ($owner -and (Get-Process -Id $owner -ErrorAction SilentlyContinue)) { throw 'Antigravity is updating.' }
    }
}

try {
    try { $locked = $mutex.WaitOne(25000) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Antigravity maintenance is busy.' }
    Check-Update
    if (Test-Path -LiteralPath $txFile) {
        $pendingTx = Get-Content -Raw -LiteralPath $txFile -Encoding UTF8
        throw ("Detected an unfinished prior transaction in $txFile. Recover any affected files from the recorded backup paths, then remove $txFile before retrying.`n$pendingTx")
    }
    $stage = Child-Path $maintenance ('.makoto-stage-' + $token)
    New-Item -ItemType Directory -Path $old -Force | Out-Null
    $action = if ($Restore) { 'restore' } else { 'install' }
    if ($isChineseAuto) {
        $report = & $node (Join-Path $PSScriptRoot 'prepare.cjs') $action $stage $install
    } else {
        $report = & $node (Join-Path $PSScriptRoot 'prepare.cjs') $action $stage $install $maintenance
    }
    if ($LASTEXITCODE -ne 0) { throw 'Could not build this version.' }
    $prepared = ($report | Select-Object -Last 1) | ConvertFrom-Json
    $active = @(Get-Client)
    if ($active.Count) {
        if ($prepared.quit) {
            Start-Process $exe -WorkingDirectory $install -ArgumentList $prepared.quit -WindowStyle Hidden
        } else {
            $main = Get-Process -Id $active.ProcessId -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0
            foreach ($proc in $main) { [void]$proc.CloseMainWindow() }
        }
        $deadline = (Get-Date).AddSeconds(30)
        while (@(Get-Client).Count) {
            if ((Get-Date) -ge $deadline) { throw 'Antigravity is still running. Quit from its tray and run this installer again.' }
            Start-Sleep -Milliseconds 350
        }
        $reopen = $true
    }
    Check-Update
    if ((Get-Item -LiteralPath $exe).VersionInfo.FileVersion -ne $prepared.version) { throw 'Antigravity changed version.' }
    if ((Get-Sha256 $archive) -ne $prepared.sourceSha256) {
        throw 'Target app.asar changed while preparing the patch; aborting before modifying any files.'
    }

    try {
        if ($prepared.mode -eq 'chinese-auto') {
            foreach ($name in @('makoto-motion', 'wallpaper', 'Rollback-Wallpaper.ps1', '回滚壁纸.cmd')) {
                $source = Child-Path $maintenance $name
                if (Test-Path -LiteralPath $source) {
                    Move-Item -LiteralPath $source -Destination (Child-Path $old $name)
                    $moved.Add($name)
                }
            }
            Move-Item -LiteralPath (Child-Path $stage 'makoto-motion') -Destination (Child-Path $maintenance 'makoto-motion')
            $placed.Add('makoto-motion')
            foreach ($file in @((Join-Path $maintenance 'maintain.cjs'), (Join-Path $maintenance 'update-hook.cjs'), $archive)) {
                $name = [IO.Path]::GetFileName($file)
                $expected = if ($file -eq $archive) { $prepared.candidateSha256 } else { '' }
                Commit-FileAtomically (Child-Path $stage $name) $file (Child-Path $old $name) $expected $prepared.mode $action
            }
        } else {
            $stageMod = Child-Path $stage 'makoto-motion'
            $stageEntries = @(Get-ChildItem -LiteralPath $stageMod -Force | Select-Object -ExpandProperty Name)
            foreach ($name in (@($stageEntries) + @('enabled') | Select-Object -Unique)) {
                $source = Child-Path $maintenance $name
                if (Test-Path -LiteralPath $source) {
                    Move-Item -LiteralPath $source -Destination (Child-Path $old $name)
                    $moved.Add($name)
                }
            }
            foreach ($name in $stageEntries) {
                Move-Item -LiteralPath (Child-Path $stageMod $name) -Destination (Child-Path $maintenance $name)
                $placed.Add($name)
            }
            Commit-FileAtomically (Child-Path $stage 'app.asar') $archive (Child-Path $old 'app.asar') $prepared.candidateSha256 $prepared.mode $action
        }

        foreach ($entry in $txEntries) {
            if ($entry.sameVolBak -and (Test-Path -LiteralPath $entry.sameVolBak)) {
                Remove-Item -LiteralPath $entry.sameVolBak -Force
            }
        }
        if (Test-Path -LiteralPath $txFile) { Remove-Item -LiteralPath $txFile -Force }
    } catch {
        $reopen = $false
        $cleanStage = $false
        $rollbackOk = $true
        $rollbackNotes = New-Object 'System.Collections.Generic.List[string]'
        try {
            for ($i = $txEntries.Count - 1; $i -ge 0; $i--) {
                $entry = $txEntries[$i]
                if ($entry.sameVolTmp -and (Test-Path -LiteralPath $entry.sameVolTmp)) {
                    try { Remove-Item -LiteralPath $entry.sameVolTmp -Force } catch {}
                }
                $curSha = if (Test-Path -LiteralPath $entry.target) { Get-Sha256 $entry.target } else { '' }
                if ($curSha -ne $entry.origSha) {
                    $restored = $false
                    if ($entry.sameVolBak -and (Test-Path -LiteralPath $entry.sameVolBak) -and ((Get-Sha256 $entry.sameVolBak) -eq $entry.origSha)) {
                        if (Test-Path -LiteralPath $entry.target) {
                            [IO.File]::Replace($entry.sameVolBak, $entry.target, $null)
                        } else {
                            [IO.File]::Move($entry.sameVolBak, $entry.target)
                        }
                        $restored = $true
                    } elseif ($entry.stageOld -and (Test-Path -LiteralPath $entry.stageOld) -and ((Get-Sha256 $entry.stageOld) -eq $entry.origSha)) {
                        $recTmp = $entry.target + ".makoto-recover-$token.tmp"
                        [IO.File]::Copy($entry.stageOld, $recTmp, $true)
                        if ((Get-Sha256 $recTmp) -eq $entry.origSha) {
                            if (Test-Path -LiteralPath $entry.target) {
                                [IO.File]::Replace($recTmp, $entry.target, $null)
                            } else {
                                [IO.File]::Move($recTmp, $entry.target)
                            }
                            $restored = $true
                        }
                    }
                    $afterSha = if (Test-Path -LiteralPath $entry.target) { Get-Sha256 $entry.target } else { '' }
                    if (-not $restored -or $afterSha -ne $entry.origSha) {
                        $rollbackOk = $false
                        $rollbackNotes.Add(("Target={0} ExpectedOrigSha={1} SameVolBak={2} StageOld={3}" -f $entry.target, $entry.origSha, $entry.sameVolBak, $entry.stageOld))
                    }
                }
                if ($rollbackOk -and $entry.sameVolBak -and (Test-Path -LiteralPath $entry.sameVolBak)) {
                    Remove-Item -LiteralPath $entry.sameVolBak -Force
                }
            }
            for ($i = $placed.Count - 1; $i -ge 0; $i--) {
                $name = $placed[$i]
                $dst = Child-Path $maintenance $name
                if (Test-Path -LiteralPath $dst) {
                    $failDir = Join-Path $stage 'failed'
                    New-Item -ItemType Directory -Path $failDir -Force | Out-Null
                    Move-Item -LiteralPath $dst -Destination (Join-Path $failDir $name)
                }
            }
            for ($i = $moved.Count - 1; $i -ge 0; $i--) {
                $name = $moved[$i]
                $srcOld = Child-Path $old $name
                $dstMaint = Child-Path $maintenance $name
                if ((Test-Path -LiteralPath $srcOld) -and !(Test-Path -LiteralPath $dstMaint)) {
                    Move-Item -LiteralPath $srcOld -Destination $dstMaint
                }
            }
        } catch {
            $rollbackOk = $false
            $rollbackNotes.Add($_.Exception.Message)
        }
        if ($rollbackOk) {
            if (Test-Path -LiteralPath $txFile) { Remove-Item -LiteralPath $txFile -Force }
            $cleanStage = $true
        } else {
            $cleanStage = $false
            Write-Warning ("Rollback incomplete; recovery files were preserved. Stage={0} Transaction={1} Details={2}" -f $stage, $txFile, ($rollbackNotes -join '; '))
        }
        throw
    }
    Write-Output ("Antigravity " + $prepared.version + " / " + $prepared.mode + " / " + $action)
} finally {
    if ($cleanStage -and (Test-Path -LiteralPath $stage)) {
        $confirmed = (Resolve-Path -LiteralPath $stage).Path
        if ($confirmed -eq (Child-Path $maintenance ('.makoto-stage-' + $token))) {
            Remove-Item -LiteralPath $confirmed -Recurse -Force
        }
    }
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
    if ($reopen) {
        if ($isChineseAuto -and (Test-Path -LiteralPath (Join-Path $maintenance 'Run.ps1'))) {
            $launcher = Join-Path $maintenance 'Run.ps1'
            $windowsPS = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $launchArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcher + '" -Mode Start'
            (New-Object -ComObject Shell.Application).ShellExecute($windowsPS, $launchArgs, $maintenance, 'open', 0)
        } else {
            (New-Object -ComObject Shell.Application).ShellExecute($exe, '', $install, 'open', 1)
        }
    }
}
