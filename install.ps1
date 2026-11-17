param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
try {
    $baseDir = $PSScriptRoot
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Install Node.js 24 LTS from https://nodejs.org/en/download, then run install.cmd again.' }
    $nodeVersion = & $node.Source --version
    $major = [int]($nodeVersion -replace '^v','').Split('.')[0]
    if ($major -lt 24) { throw "Node.js 24 or newer is required. Found $nodeVersion." }
    & $node.Source --disable-warning=ExperimentalWarning --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; if(typeof WebSocket!=='function')process.exit(1);"
    if ($LASTEXITCODE -ne 0) { throw 'Node.js SQLite/WebSocket capability check failed.' }
    Write-Host "[OK] Node.js $nodeVersion"

    $pkg = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1
    $appExe = $null
    if ($pkg) {
        foreach ($name in @('ChatGPT.exe','Codex.exe')) {
            $candidate = Join-Path $pkg.InstallLocation "app\$name"
            if (Test-Path -LiteralPath $candidate) { $appExe = $candidate; break }
        }
    }
    if (-not $appExe) {
        $appExe = Get-CimInstance Win32_Process | Where-Object {
            $_.Name -in @('ChatGPT.exe','Codex.exe') -and $_.ExecutablePath -match '\\app\\(?:ChatGPT|Codex)\.exe$' -and $_.CommandLine -notmatch '--type='
        } | Select-Object -First 1 -ExpandProperty ExecutablePath
    }
    if (-not $appExe) { throw 'Install and open Codex Desktop first, then run install.cmd again.' }
    Write-Host '[OK] Codex Desktop'

    $codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
    $database = Get-ChildItem -LiteralPath $codexDir -Filter 'state_*.sqlite' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $database) { throw 'Open Codex and finish at least one local chat first, then run install.cmd again.' }
    Write-Host '[OK] Local Codex usage database'
    try {
        $null = Invoke-RestMethod 'http://127.0.0.1:3425/v1/magpie/usage/requests?agent=codex&limit=1' -TimeoutSec 3
        Write-Host '[OK] Local Magpie request statistics'
    } catch {
        Write-Host '[NOTE] Magpie is not available at 127.0.0.1:3425. Cache/context still work; precise decode speed and first-token latency need Magpie records.'
    }
    if ($CheckOnly) { Write-Host 'Checks completed. No shortcut was changed.'; exit 0 }
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $desktop 'Codex Usage Bar.lnk'))
    $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $shortcut.Arguments = '"' + (Join-Path $baseDir 'start.vbs') + '"'
    $shortcut.WorkingDirectory = $baseDir
    $shortcut.IconLocation = "$appExe,0"
    $shortcut.Description = 'Codex++ usage status line only'
    $shortcut.Save()
    Write-Host 'Ready. Open the desktop shortcut: Codex Usage Bar'
    Write-Host 'Keep this extracted folder in its current location. Run install.cmd again if you move it.'
} catch {
    Write-Host ('[ERROR] ' + $_.Exception.Message)
    exit 1
}
