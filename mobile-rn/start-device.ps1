# Start the Expo dev server with the CORRECT LAN IP advertised, so a phone on
# the same network can reach it. Auto-detects the Wi-Fi (or active) IPv4.
#
# Usage:  powershell -ExecutionPolicy Bypass -File start-device.ps1
#         powershell -ExecutionPolicy Bypass -File start-device.ps1 -Tunnel

param([switch]$Tunnel)

$ErrorActionPreference = "Stop"

# Prefer the Wi-Fi / hotspot address (that is where the phone lives), fall back
# to any non-virtual IPv4.
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -like 'Wi-Fi*' } |
  Select-Object -First 1).IPAddress

if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'WSL|VMware|VirtualBox|Loopback' } |
    Select-Object -First 1).IPAddress
}

if ($ip) {
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
  Write-Output ("Advertising host: " + $ip)
  Write-Output ("Phone should be on the same network. Test in phone Safari: http://" + $ip + ":8081")
} else {
  Write-Output "Could not detect a LAN IP; Expo will pick its own."
}

Write-Output ""
if ($Tunnel) {
  npx expo start --tunnel
} else {
  npx expo start
}
