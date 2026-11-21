$path = 'C:\Users\HP\Desktop\crunchbox\my-food-app\frontend\static\css\main.css'
$content = Get-Content $path -Raw

# Use regex to find and replace the desktop shop-logo-area block
# Pattern matches: .shop-logo-area { ... position: absolute; left: 50%; transform: translateX(-50%); }
$pattern = '(\.shop-logo-area\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*gap:\s*8px;\s*)position:\s*absolute;\s*left:\s*50%;\s*transform:\s*translateX\(-50%\);\s*\}'
$replacement = '${1}position: static; left: auto; transform: none;}'

if ([regex]::IsMatch($content, $pattern)) {
    $content = [regex]::Replace($content, $pattern, $replacement)
    Set-Content $path $content
    'Logo position fixed: shop-logo-area changed to position: static'
} else {
    'Pattern did not match. Checking for any shop-logo-area with position: absolute...'
    $pattern2 = '\.shop-logo-area\s*\{[^}]*position:\s*absolute[^}]*\}'
    $matches = [regex]::Matches($content, $pattern2, 'SingleLine')
    $matches | ForEach-Object { "Found: " + $_.Value.Substring(0, [Math]::Min(100, $_.Value.Length)) + "..." }
}
