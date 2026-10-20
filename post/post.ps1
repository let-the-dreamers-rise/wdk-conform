# Posts the wdk-conform findings upstream as the signed-in GitHub user.
# Needs the GitHub CLI signed in: winget install GitHub.cli ; gh auth login
$ErrorActionPreference = 'Stop'
$raw = 'https://raw.githubusercontent.com/let-the-dreamers-rise/wdk-conform/main/post'
$dir = Join-Path $env:TEMP 'wdk-conform-post'
New-Item -ItemType Directory -Force $dir | Out-Null
function Get-Body($name) {
  $f = Join-Path $dir $name
  Invoke-WebRequest "$raw/$name" -OutFile $f -UseBasicParsing
  $f
}

$issue = gh issue create -R tetherto/wdk-wallet-btc `
  --title "Default config derives mainnet addresses under the testnet coin type (m/84'/1'), so seeds don't restore in other wallets" `
  --body-file (Get-Body 'issue-btc-default-network.md')
Write-Output "BTC issue: $issue"
$num = ($issue -split '/')[-1]

$prBody = Get-Body 'pr-body.md'
(Get-Content $prBody -Raw).Replace('ISSUE_NUMBER', $num) | Set-Content $prBody -NoNewline
$pr = gh pr create -R tetherto/wdk-wallet-btc --base main `
  --head let-the-dreamers-rise:fix/default-network-coin-type `
  --title 'fix: default to the mainnet coin type when no network is configured' `
  --body-file $prBody
Write-Output "BTC PR: $pr"

foreach ($repo in 'wdk-wallet-btc','wdk-wallet-ton','wdk-wallet-evm','wdk-wallet-tron','wdk-wallet-solana') {
  $u = gh issue create -R "tetherto/$repo" `
    --title 'getAccountByPath accepts ambiguous paths that alias other keys' `
    --body-file (Get-Body "issue-path-$repo.md")
  Write-Output "Path issue ($repo): $u"
}
Write-Output 'Done. Paste these links back in the thread.'
