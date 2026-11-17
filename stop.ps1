$stateDir = Join-Path $PSScriptRoot 'runtime'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
Set-Content -LiteralPath (Join-Path $stateDir 'stop-9337') -Value 'stop'
# The helper removes the injected DOM and CSS. Codex itself stays open.
