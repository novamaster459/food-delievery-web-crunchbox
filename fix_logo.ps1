$path = "C:\Users\HP\Desktop\crunchbox\frontend\static\css\main.css"
$content = Get-Content $path -Raw

$old = @'
.shop-logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
'@

$new = @'
.shop-logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
  position: static;
  transform: none;
  flex: 0 1 auto;
  min-width: 0;
  margin-left: 0;
}
'@

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    Set-Content $path $content
    Write-Host "Replaced shop-logo-area successfully"
} else {
    Write-Host "Could not find exact match"
    $lines = Get-Content $path
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '\.shop-logo-area\s*\{') {
            Write-Host ("Found at line {0}: {1}" -f $i, $lines[$i])
        }
    }
}
