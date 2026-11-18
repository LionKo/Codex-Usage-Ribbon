param(
    [Parameter(Mandatory)][string]$Destination
)
$ErrorActionPreference = 'Stop'

if ([IO.Path]::GetFileName($Destination) -cne 'ChatGPT.lnk') {
    throw 'The Start shortcut must be named ChatGPT.lnk.'
}
$destination = [IO.Path]::GetFullPath($Destination)
$parent = Split-Path -Parent $destination
if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    throw "Create the shortcut destination folder first: $parent"
}

$package = Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
if (-not $package) { throw 'The official ChatGPT desktop app is not installed.' }
$runtime = Join-Path $PSScriptRoot 'runtime'
New-Item -Path $runtime -ItemType Directory -Force | Out-Null

# Store a multi-size icon made from the installed app's own Start-menu logo.
$theme = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -ErrorAction SilentlyContinue
$variant = if ($theme.SystemUsesLightTheme -eq 1) { 'lightunplated' } else { 'unplated' }
$images = @(Get-ChildItem -LiteralPath (Join-Path $package.InstallLocation 'assets') -Filter "Square44x44Logo.targetsize-*_altform-$variant.png" |
    ForEach-Object {
        if ($_.Name -match 'targetsize-(\d+)_') {
            [pscustomobject]@{ Size = [int]$Matches[1]; Png = [IO.File]::ReadAllBytes($_.FullName) }
        }
    } | Sort-Object Size)
if (-not $images.Count) { throw 'The official ChatGPT Start icon assets were not found.' }

$icon = Join-Path $runtime "chatgpt-start-$variant.ico"
$iconFile = [IO.File]::Open($icon, [IO.FileMode]::Create, [IO.FileAccess]::Write)
$writer = [IO.BinaryWriter]::new($iconFile)
try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$images.Count)
    $offset = 6 + 16 * $images.Count
    foreach ($image in $images) {
        $size = [byte]($image.Size % 256)
        $writer.Write($size)
        $writer.Write($size)
        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$image.Png.Length)
        $writer.Write([uint32]$offset)
        $offset += $image.Png.Length
    }
    foreach ($image in $images) { $writer.Write([byte[]]$image.Png) }
} finally { $writer.Dispose() }

if (-not ('RibbonShellLink' -as [type])) {
    Add-Type -Path (Join-Path $PSScriptRoot 'start-link.cs')
}
$appId = 'ChatGPT.UsageRibbon.Launcher'
$temp = Join-Path $parent ("UsageRibbon-" + [guid]::NewGuid().ToString('N') + ".lnk")
try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($temp)
    $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $shortcut.Arguments = '"' + (Join-Path $PSScriptRoot 'start.vbs') + '"'
    $shortcut.WorkingDirectory = $PSScriptRoot
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Description = 'ChatGPT'
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    [RibbonShellLink]::WriteId($temp, $appId)
    if ([RibbonShellLink]::ReadId($temp) -cne $appId) { throw 'Could not verify the ChatGPT shortcut identity.' }
    if (Test-Path -LiteralPath $destination) {
        [IO.File]::Replace($temp, $destination, [NullString]::Value)
    } else {
        [IO.File]::Move($temp, $destination)
    }
} finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
}
Get-Item -LiteralPath $destination
