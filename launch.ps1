param([int]$Port = 9337)
$ErrorActionPreference = 'Stop'
$baseDir = $PSScriptRoot
$stateDir = Join-Path $baseDir 'runtime'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
. (Join-Path $baseDir 'launch-core.ps1')
# Serialize launches across ports and extracted copies of the tool.
$mutex = New-Object System.Threading.Mutex($false, 'Local\CodexUsageBarLaunch')
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { return }
    $nodePath = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $app = Start-OrReuseCodex -Port $Port
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.AppActivate([int]$app.ProcessId)
    if (-not $app.DebugEnabled) {
        # Debugging cannot be enabled on an already-running Electron process.
        # Never launch an isolated replacement or terminate an active chat.
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show(
            'ChatGPT is already running. To load the status bar, fully exit ChatGPT when your work is finished, then open the pinned ChatGPT entry again.',
            'ChatGPT'
        ) | Out-Null
        return
    }
    $ready = $false
    # Keep the launch mutex while Electron starts; repeated clicks cannot race.
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $targets = @(Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 1)
            $ready = [bool]($targets | Where-Object { $_.type -eq 'page' -and $_.url -match '^app://-/index\.html(?:$|\?)' })
        } catch {}
        if ($ready) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Codex is open, but its debugging connection is unavailable. Fully exit Codex and open Codex Usage Bar again. No additional instance was started.' }
    $hostRunning = $false
    $hostState = Join-Path $stateDir "host-$Port.json"
    if (Test-Path -LiteralPath $hostState) {
        $saved = Get-Content -LiteralPath $hostState -Raw | ConvertFrom-Json
        $running = Get-CimInstance Win32_Process -Filter "ProcessId=$($saved.pid)"
        $hostRunning = $running -and $running.Name -eq 'node.exe' -and $running.CommandLine.Contains((Join-Path $baseDir 'host.mjs'))
    }
    if (-not $hostRunning) {
        $hostArgs = @('--disable-warning=ExperimentalWarning',('"' + (Join-Path $baseDir 'host.mjs') + '"'),"--port=$Port")
        Start-Process -FilePath $nodePath -ArgumentList $hostArgs -WindowStyle Hidden -WorkingDirectory $baseDir -RedirectStandardOutput (Join-Path $stateDir "host-$Port.log") -RedirectStandardError (Join-Path $stateDir "host-$Port-error.log") | Out-Null
    }
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + (Join-Path $baseDir 'focus.mjs') + '"'),"$Port") -WindowStyle Hidden | Out-Null
} catch {
    $_.Exception.Message | Set-Content -LiteralPath (Join-Path $stateDir 'launch-error.txt')
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($_.Exception.Message,'Codex Usage Bar') | Out-Null
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
