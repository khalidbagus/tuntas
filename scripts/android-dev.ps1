param([int]$Port = 5173, [switch]$Disconnect)
$ErrorActionPreference = 'Stop'

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$candidates = @(
    "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe",
    "$env:LOCALAPPDATA/Microsoft/WinGet/Links/adb.exe",
    "$env:LOCALAPPDATA/Microsoft/WinGet/Packages/Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe/platform-tools/adb.exe"
)
$adbPath = if ($adbCommand) { $adbCommand.Source } else {
    $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $adbPath) {
    throw 'Install Google.PlatformTools through winget or Android Studio, then retry.'
}
$devices = @(& $adbPath devices)
if ($LASTEXITCODE -ne 0) { throw 'ADB could not list devices.' }
$ready = @($devices | Where-Object { $_ -match '\sdevice$' })
if ($ready.Count -ne 1) {
    throw 'Connect exactly one authorized Android phone over USB. Unlock it and approve the USB debugging prompt.'
}
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose a port from 1024 to 65535.' }
if ($Disconnect) {
    & $adbPath -d reverse --remove "tcp:$Port"
    if ($LASTEXITCODE -ne 0) { throw 'Could not remove USB forwarding.' }
    Write-Output "Removed USB forwarding for port $Port."
    exit
}
if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
    throw "Start Tuntas first with npm.cmd run dev -- --port $Port --strictPort."
}
& $adbPath -d reverse "tcp:$Port" "tcp:$Port"
if ($LASTEXITCODE -ne 0) { throw 'Could not create USB forwarding.' }
Write-Output "USB forwarding is ready. Open http://localhost:$Port in Chrome on the phone."
Write-Output 'Use chrome://inspect/#devices in desktop Chrome to inspect the phone tab.'
