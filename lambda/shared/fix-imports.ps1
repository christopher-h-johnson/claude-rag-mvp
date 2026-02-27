# Fix import statements in audit-logger files to add .mjs extension
param(
    [string]$Path = "."
)

Get-ChildItem -Path $Path -Filter "*.js" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # Use regex callback to properly capture and replace
    $content = [regex]::Replace($content, "from '\.\/([^']+)'", {
        param($match)
        "from './$($match.Groups[1].Value).mjs'"
    })
    
    Set-Content $_.FullName $content -NoNewline
    
    # Rename to .mjs
    $newName = $_.Name -replace '\.js$', '.mjs'
    Rename-Item $_.FullName -NewName $newName -Force
}
