# Cuts Mama's wedding discs and ceremony tapes into short MP4 clips (lossless: no re-encoding).
# Run from the Papa folder:  powershell -ExecutionPolicy Bypass -File tools\cut_mama_clips.ps1
# Needs ffmpeg:  winget install --id Gyan.FFmpeg -e   (then open a NEW PowerShell window)
$ErrorActionPreference = "Stop"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Host "ffmpeg not found. Run: winget install --id Gyan.FFmpeg -e  then open a new PowerShell window." -ForegroundColor Red; exit 1 }
$base = Join-Path (Split-Path $PSScriptRoot -Parent) "Mama"
New-Item -ItemType Directory -Force -Path (Join-Path $base "WeddingClips"), (Join-Path $base "CeremonyClips") | Out-Null
$clips = @(
  @("Wedding Video\NEW_disc1.mkv", "0.061", "283.28", "WeddingClips\Mama-Wedding-01.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "283.341", "185.76", "WeddingClips\Mama-Wedding-02.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "469.101", "276.32", "WeddingClips\Mama-Wedding-03.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "745.421", "279.519", "WeddingClips\Mama-Wedding-04.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "1024.94", "215.64", "WeddingClips\Mama-Wedding-05.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "1240.58", "204.64", "WeddingClips\Mama-Wedding-06.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "1445.22", "274.4", "WeddingClips\Mama-Wedding-07.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "1719.62", "261.64", "WeddingClips\Mama-Wedding-08.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "1981.26", "199.2", "WeddingClips\Mama-Wedding-09.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "2180.46", "181.8", "WeddingClips\Mama-Wedding-10.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "2362.26", "291.52", "WeddingClips\Mama-Wedding-11.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "2653.78", "265.8", "WeddingClips\Mama-Wedding-12.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "2919.58", "239.72", "WeddingClips\Mama-Wedding-13.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "3159.3", "206.48", "WeddingClips\Mama-Wedding-14.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "3365.78", "183.44", "WeddingClips\Mama-Wedding-15.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "3549.22", "216.04", "WeddingClips\Mama-Wedding-16.mp4"),
  @("Wedding Video\NEW_disc1.mkv", "3765.26", "291.3", "WeddingClips\Mama-Wedding-17.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "0.061", "260.72", "WeddingClips\Mama-Wedding-18.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "260.781", "216.04", "WeddingClips\Mama-Wedding-19.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "476.821", "239.4", "WeddingClips\Mama-Wedding-20.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "716.221", "181.44", "WeddingClips\Mama-Wedding-21.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "897.661", "276.879", "WeddingClips\Mama-Wedding-22.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "1174.54", "203.64", "WeddingClips\Mama-Wedding-23.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "1378.18", "273.08", "WeddingClips\Mama-Wedding-24.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "1651.26", "228.4", "WeddingClips\Mama-Wedding-25.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "1879.66", "261.92", "WeddingClips\Mama-Wedding-26.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "2141.58", "270.76", "WeddingClips\Mama-Wedding-27.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "2412.34", "196.84", "WeddingClips\Mama-Wedding-28.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "2609.18", "251.8", "WeddingClips\Mama-Wedding-29.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "2860.98", "255.2", "WeddingClips\Mama-Wedding-30.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "3116.18", "297.48", "WeddingClips\Mama-Wedding-31.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "3413.66", "272.68", "WeddingClips\Mama-Wedding-32.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "3686.34", "278.76", "WeddingClips\Mama-Wedding-33.mp4"),
  @("Wedding Video\NEW_disc2.mkv", "3965.1", "127.02", "WeddingClips\Mama-Wedding-34.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "0.061", "208.2", "WeddingClips\Mama-Wedding-35.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "208.261", "205.04", "WeddingClips\Mama-Wedding-36.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "413.301", "203.64", "WeddingClips\Mama-Wedding-37.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "616.941", "191.08", "WeddingClips\Mama-Wedding-38.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "808.021", "194.719", "WeddingClips\Mama-Wedding-39.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "1002.74", "207.56", "WeddingClips\Mama-Wedding-40.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "1210.3", "202.8", "WeddingClips\Mama-Wedding-41.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "1413.1", "250.08", "WeddingClips\Mama-Wedding-42.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "1663.18", "232.28", "WeddingClips\Mama-Wedding-43.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "1895.46", "296.48", "WeddingClips\Mama-Wedding-44.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "2191.94", "277.88", "WeddingClips\Mama-Wedding-45.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "2469.82", "187.12", "WeddingClips\Mama-Wedding-46.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "2656.94", "191.88", "WeddingClips\Mama-Wedding-47.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "2848.82", "254.36", "WeddingClips\Mama-Wedding-48.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "3103.18", "205.2", "WeddingClips\Mama-Wedding-49.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "3308.38", "225.96", "WeddingClips\Mama-Wedding-50.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "3534.34", "268.4", "WeddingClips\Mama-Wedding-51.mp4"),
  @("Wedding Video\NEW_disc3.mkv", "3802.74", "296.22", "WeddingClips\Mama-Wedding-52.mp4"),
  @("Puberty Function\Disk 1.mkv", "0.021", "202.68", "CeremonyClips\Mama-Ceremony-01.mp4"),
  @("Puberty Function\Disk 1.mkv", "202.701", "202.28", "CeremonyClips\Mama-Ceremony-02.mp4"),
  @("Puberty Function\Disk 1.mkv", "404.981", "251.2", "CeremonyClips\Mama-Ceremony-03.mp4"),
  @("Puberty Function\Disk 1.mkv", "656.181", "227.52", "CeremonyClips\Mama-Ceremony-04.mp4"),
  @("Puberty Function\Disk 1.mkv", "883.701", "198.239", "CeremonyClips\Mama-Ceremony-05.mp4"),
  @("Puberty Function\Disk 1.mkv", "1081.94", "193.12", "CeremonyClips\Mama-Ceremony-06.mp4"),
  @("Puberty Function\Disk 1.mkv", "1275.06", "262.16", "CeremonyClips\Mama-Ceremony-07.mp4"),
  @("Puberty Function\Disk 1.mkv", "1537.22", "279.4", "CeremonyClips\Mama-Ceremony-08.mp4"),
  @("Puberty Function\Disk 1.mkv", "1816.62", "185.52", "CeremonyClips\Mama-Ceremony-09.mp4"),
  @("Puberty Function\Disk 1.mkv", "2002.14", "219.08", "CeremonyClips\Mama-Ceremony-10.mp4"),
  @("Puberty Function\Disk 1.mkv", "2221.22", "195.76", "CeremonyClips\Mama-Ceremony-11.mp4"),
  @("Puberty Function\Disk 1.mkv", "2416.98", "279.44", "CeremonyClips\Mama-Ceremony-12.mp4"),
  @("Puberty Function\Disk 1.mkv", "2696.42", "287.64", "CeremonyClips\Mama-Ceremony-13.mp4"),
  @("Puberty Function\Disk 1.mkv", "2984.06", "278.04", "CeremonyClips\Mama-Ceremony-14.mp4"),
  @("Puberty Function\Disk 1.mkv", "3262.1", "199.66", "CeremonyClips\Mama-Ceremony-15.mp4"),
  @("Puberty Function\Disk 2.mkv", "0.021", "260.96", "CeremonyClips\Mama-Ceremony-16.mp4"),
  @("Puberty Function\Disk 2.mkv", "260.981", "202.44", "CeremonyClips\Mama-Ceremony-17.mp4"),
  @("Puberty Function\Disk 2.mkv", "463.421", "233.08", "CeremonyClips\Mama-Ceremony-18.mp4"),
  @("Puberty Function\Disk 2.mkv", "696.501", "216.44", "CeremonyClips\Mama-Ceremony-19.mp4"),
  @("Puberty Function\Disk 2.mkv", "912.941", "294.239", "CeremonyClips\Mama-Ceremony-20.mp4"),
  @("Puberty Function\Disk 2.mkv", "1207.18", "254.36", "CeremonyClips\Mama-Ceremony-21.mp4"),
  @("Puberty Function\Disk 2.mkv", "1461.54", "252.88", "CeremonyClips\Mama-Ceremony-22.mp4"),
  @("Puberty Function\Disk 2.mkv", "1714.42", "244.84", "CeremonyClips\Mama-Ceremony-23.mp4"),
  @("Puberty Function\Disk 2.mkv", "1959.26", "211.24", "CeremonyClips\Mama-Ceremony-24.mp4"),
  @("Puberty Function\Disk 2.mkv", "2170.5", "227.72", "CeremonyClips\Mama-Ceremony-25.mp4"),
  @("Puberty Function\Disk 2.mkv", "2398.22", "236.6", "CeremonyClips\Mama-Ceremony-26.mp4"),
  @("Puberty Function\Disk 2.mkv", "2634.82", "213.68", "CeremonyClips\Mama-Ceremony-27.mp4"),
  @("Puberty Function\Disk 2.mkv", "2848.5", "258.98", "CeremonyClips\Mama-Ceremony-28.mp4")
)
$n = 0
foreach ($c in $clips) {
  $n++
  $src = Join-Path $base $c[0]; $out = Join-Path $base $c[3]
  if (Test-Path $out) { Write-Host "[$n/$($clips.Count)] already done: $($c[3])"; continue }
  $tmp = $out -replace "\.mp4$", ".part.mp4"
  Write-Host "[$n/$($clips.Count)] $($c[3])"
  & ffmpeg -hide_banner -loglevel error -y -ss $c[1] -i $src -t $c[2] -map 0:v:0 -map 0:a:0 -c copy -avoid_negative_ts make_zero -movflags +faststart $tmp
  if ($LASTEXITCODE -ne 0) { Write-Host "Failed on $($c[3])" -ForegroundColor Red; exit 1 }
  Move-Item -Force $tmp $out
}
Write-Host "All $($clips.Count) clips are ready in Mama\WeddingClips and Mama\CeremonyClips." -ForegroundColor Green
