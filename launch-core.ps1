function Get-CodexDesktopProcesses {
    # Exclude renderer/utility processes and the CLI app-server in resources/.
    Get-CimInstance Win32_Process | Where-Object {
        $_.Name -in @('ChatGPT.exe', 'Codex.exe') -and
        $_.ExecutablePath -match '\\app\\(?:ChatGPT|Codex)\.exe$' -and
        $_.CommandLine -notmatch '--type='
    }
}

function Resolve-CodexExecutable {
    $pkg = Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
    if ($pkg) {
        foreach ($name in @('ChatGPT.exe', 'Codex.exe')) {
            $candidate = Join-Path $pkg.InstallLocation "app\$name"
            if (Test-Path -LiteralPath $candidate) { return $candidate }
        }
    }
    throw 'Cannot find the installed Codex desktop app.'
}

function Start-OrReuseCodex {
    param([int]$Port)
    $portPattern = '(?:^|\s)--remote-debugging-port(?:=|\s+)' + $Port + '(?:\s|$)'
    $running = @(Get-CodexDesktopProcesses)
    if ($running.Count -gt 0) {
        # Also reuse legacy isolated windows until the user closes them normally.
        $existing = $running | Where-Object { $_.CommandLine -match $portPattern } | Select-Object -First 1
        if (-not $existing) { $existing = $running[0] }
        return [pscustomobject]@{
            ProcessId = $existing.ProcessId
            DebugEnabled = [bool]($existing.CommandLine -match $portPattern)
            Started = $false
        }
    }

    $appExe = Resolve-CodexExecutable
    # Share the official app's default profile and single-instance lock. A stale
    # override inherited from an older launcher must not create another profile.
    $previousProfile = $env:CODEX_ELECTRON_USER_DATA_PATH
    try {
        $env:CODEX_ELECTRON_USER_DATA_PATH = $null
        $app = Start-Process -FilePath $appExe -ArgumentList @(
            "--remote-debugging-port=$Port", '--remote-debugging-address=127.0.0.1'
        ) -WindowStyle Normal -PassThru
    } finally {
        $env:CODEX_ELECTRON_USER_DATA_PATH = $previousProfile
    }
    return [pscustomobject]@{ ProcessId = $app.Id; DebugEnabled = $true; Started = $true }
}
