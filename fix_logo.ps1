$path = 'C:\Users\HP\Desktop\crunchbox\my-food-app\frontend\static\css\main.css'
$content = Get-Content $path -Raw

# Replace desktop shop-logo-area centering with static positioning (logo to the left)
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
  left: auto;
  transform: none;
}
'@

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    Set-Content $path $content
    'Logo position fixed: shop-logo-area changed to position: static'
} else {
    'Exact match not found for desktop shop-logo-area'
    # Show what's actually there
    $lines = Get-Content $path
    $lines | Select-String -Pattern 'shop-logo-area|position: absolute|left: 50%' -Context 0,3
}
