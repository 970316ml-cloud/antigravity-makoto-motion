param([switch]$Restore, [string]$InstallDir = '')
$ErrorActionPreference = 'Stop'

function Child-Path($parent, $leaf) {
    $resolved = [IO.Path]::GetFullPath((Join-Path $parent $leaf))
    if ([IO.Path]::GetDirectoryName($resolved) -ne $parent) { throw 'Unexpected maintenance path.' }
    return $resolved
}

function Find-AntigravityDir([string]$explicit) {
    $candidates = @()
    if ($explicit) { $candidates += $explicit }
    $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\antigravity')
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'Antigravity') }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Antigravity') }
    foreach ($dir in $candidates) {
        if (!$dir) { continue }
        $exePath = Join-Path $dir 'Antigravity.exe'
        $asarPath = Join-Path $dir 'resources\app.asar'
        if ((Test-Path -LiteralPath $exePath) -and (Test-Path -LiteralPath $asarPath)) {
            return (Resolve-Path -LiteralPath $dir).Path
        }
    }
    throw 'Could not locate Antigravity installation (Antigravity.exe / resources\app.asar). Pass -InstallDir "<path>" if installed in a custom directory.'
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

function Swap-File([string]$sourceFile, [string]$targetFile, [string]$backupFile) {
    if ([IO.Path]::GetPathRoot($sourceFile) -ieq [IO.Path]::GetPathRoot($targetFile)) {
        [IO.File]::Replace($sourceFile, $targetFile, $backupFile)
    } else {
        if (Test-Path -LiteralPath $targetFile) { [IO.File]::Copy($targetFile, $backupFile, $true) }
        [IO.File]::Copy($sourceFile, $targetFile, $true)
    }
}

$install = Find-AntigravityDir $InstallDir
$exe = Join-Path $install 'Antigravity.exe'
$archive = Join-Path $install 'resources\app.asar'
$chineseRoot = Join-Path $env:LOCALAPPDATA 'Programs\AntigravityChineseAuto'
$isChineseAuto = (Test-Path -LiteralPath (Join-Path $chineseRoot 'maintain.cjs')) -and (Test-Path -LiteralPath (Join-Path $chineseRoot 'update-hook.cjs'))
if ($isChineseAuto) {
    $maintenance = (Resolve-Path -LiteralPath $chineseRoot).Path
    $mutexName = 'Local\AntigravityChineseAutoRestore'
} else {
    $standaloneDir = Join-Path $env:LOCALAPPDATA 'Programs\AntigravityMakotoMotion'
    New-Item -ItemType Directory -Path $standaloneDir -Force | Out-Null
    $maintenance = (Resolve-Path -LiteralPath $standaloneDir).Path
    $mutexName = 'Local\AntigravityMakotoMotion'
}

$node = Find-Node $chineseRoot
$token = [guid]::NewGuid().ToString('N')
$stage = Join-Path $maintenance ('.makoto-stage-' + $token)
$old = Join-Path $stage 'previous'
$mutex = New-Object Threading.Mutex($false, $mutexName)
$locked = $false
$reopen = $false
$cleanStage = $true
$replaced = New-Object 'System.Collections.Generic.List[string]'
$moved = New-Object 'System.Collections.Generic.List[string]'
$placed = New-Object 'System.Collections.Generic.List[string]'

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
                Swap-File (Child-Path $stage $name) $file (Child-Path $old $name)
                $replaced.Add($file)
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
            Swap-File (Child-Path $stage 'app.asar') $archive (Child-Path $old 'app.asar')
            $replaced.Add($archive)
        }
    } catch {
        $cleanStage = $false
        foreach ($file in $replaced) { [IO.File]::Copy((Child-Path $old ([IO.Path]::GetFileName($file))), $file, $true) }
        foreach ($name in $placed) {
            $dst = Child-Path $maintenance $name
            if (Test-Path -LiteralPath $dst) {
                $failDir = Join-Path $stage 'failed'
                New-Item -ItemType Directory -Path $failDir -Force | Out-Null
                Move-Item -LiteralPath $dst -Destination (Join-Path $failDir $name)
            }
        }
        foreach ($name in $moved) { Move-Item -LiteralPath (Child-Path $old $name) -Destination (Child-Path $maintenance $name) }
        $cleanStage = $true
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
