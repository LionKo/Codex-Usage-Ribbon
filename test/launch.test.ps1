$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot) 'launch-core.ps1')

# No Pester dependency; mock OS boundaries so tests never open or close Codex.
$script:processes = @()
$script:launches = @()
$script:failLaunch = $false
function Get-CimInstance { param($ClassName) return $script:processes }
function Resolve-CodexExecutable { return 'C:\Test\app\ChatGPT.exe' }
function Start-Process {
    param($FilePath, $ArgumentList, $WindowStyle, [switch]$PassThru)
    $script:launches += [pscustomobject]@{
        File = $FilePath; Arguments = $ArgumentList
        Profile = $env:CODEX_ELECTRON_USER_DATA_PATH; CodexHome = $env:CODEX_HOME
    }
    if ($script:failLaunch) { throw 'Simulated start failure' }
    return [pscustomobject]@{ Id = 100 }
}
function Assert($Condition, $Message) {
    if (-not $Condition) { throw $Message }
}
function DesktopProcess($Id, $Arguments = '') {
    return [pscustomobject]@{
        Name = 'ChatGPT.exe'; ExecutablePath = 'C:\Test\app\ChatGPT.exe'
        ProcessId = $Id; CommandLine = '"C:\Test\app\ChatGPT.exe" ' + $Arguments
    }
}

$originalProfile = $env:CODEX_ELECTRON_USER_DATA_PATH
$originalHome = $env:CODEX_HOME
try {
    $script:processes = @(
        (DesktopProcess 1 '--type=renderer'),
        [pscustomobject]@{ Name = 'codex.exe'; ExecutablePath = 'C:\Test\app\resources\codex.exe'; ProcessId = 2; CommandLine = 'codex.exe app-server' },
        (DesktopProcess 3)
    )
    $found = @(Get-CodexDesktopProcesses)
    Assert ($found.Count -eq 1 -and $found[0].ProcessId -eq 3) 'Must exclude Electron children and CLI servers.'
    Write-Output 'PASS: only desktop main processes count as instances'

    $result = Start-OrReuseCodex -Port 9337
    Assert ($result.ProcessId -eq 3 -and -not $result.DebugEnabled -and -not $result.Started) 'Reuse ordinary Codex without debugging.'
    Assert ($script:launches.Count -eq 0) 'Ordinary Codex must prevent another launch.'
    Write-Output 'PASS: ordinary running Codex is reused without launching'

    $script:processes = @((DesktopProcess 4 '--remote-debugging-port=9337 --user-data-dir="C:\Old\codex-profile"'))
    1..3 | ForEach-Object {
        $result = Start-OrReuseCodex -Port 9337
        Assert ($result.ProcessId -eq 4 -and $result.DebugEnabled -and -not $result.Started) 'Reuse legacy profile.'
    }
    Assert ($script:launches.Count -eq 0) 'Repeated clicks must never launch another app.'
    Write-Output 'PASS: repeated launches reuse legacy isolated Codex'

    $script:processes = @((DesktopProcess 3), (DesktopProcess 4 '--remote-debugging-port=9337'))
    $result = Start-OrReuseCodex -Port 9337
    Assert ($result.ProcessId -eq 4 -and $script:launches.Count -eq 0) 'Prefer existing debugging instance during migration.'
    Write-Output 'PASS: migration with two existing instances creates no third'

    $script:processes = @((DesktopProcess 5 '--remote-debugging-port=93370'))
    $result = Start-OrReuseCodex -Port 9337
    Assert (-not $result.DebugEnabled -and $script:launches.Count -eq 0) 'Different ports must not bypass single instance checks.'
    Write-Output 'PASS: a different port never permits another instance'

    $script:processes = @()
    $env:CODEX_ELECTRON_USER_DATA_PATH = 'C:\Old\codex-profile'
    $env:CODEX_HOME = 'C:\ExistingCodexHome'
    $result = Start-OrReuseCodex -Port 9337
    Assert ($result.Started -and $result.ProcessId -eq 100 -and $script:launches.Count -eq 1) 'Launch once when no Codex exists.'
    $launch = $script:launches[0]
    Assert (-not $launch.Profile) 'Child must not inherit the isolated profile override.'
    Assert (($launch.Arguments -join ' ') -notmatch 'user-data-dir') 'Child must use the official default profile.'
    Assert ($launch.Arguments -contains '--remote-debugging-port=9337') 'Usage bar debugging must remain enabled.'
    Assert ($launch.CodexHome -eq 'C:\ExistingCodexHome') 'Preserve accounts and chat storage.'
    Assert ($env:CODEX_ELECTRON_USER_DATA_PATH -eq 'C:\Old\codex-profile') 'Restore caller environment.'
    Write-Output 'PASS: cold start uses default profile and preserves CODEX_HOME'

    $script:failLaunch = $true
    $failed = $false
    try { $null = Start-OrReuseCodex -Port 9337 } catch { $failed = $true }
    Assert ($failed -and $env:CODEX_ELECTRON_USER_DATA_PATH -eq 'C:\Old\codex-profile') 'Restore environment after launch failure.'
    Write-Output 'PASS: launch failure restores caller environment'
} finally {
    $env:CODEX_ELECTRON_USER_DATA_PATH = $originalProfile
    $env:CODEX_HOME = $originalHome
}
