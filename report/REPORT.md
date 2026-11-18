# wdk-conform report

1329 cases, 9 of 30 checks failing.

## Modules tested

- `@tetherto/wdk-wallet-evm@1.0.0-beta.26`
- `@tetherto/wdk-wallet-btc@1.0.0-beta.18`
- `@tetherto/wdk-wallet-solana@1.0.0-beta.21`
- `@tetherto/wdk-wallet-ton@1.0.0-beta.20`
- `@tetherto/wdk-wallet-tron@1.0.0-beta.18`
- `@tetherto/wdk-wallet-aptos@1.0.0-beta.7`

## Results

| check | chain | config | cases | result |
|---|---|---|---|---|
| portability | evm | `{}` | 32 | pass |
| portability | btc | `{}` | 32 | **32 fail** |
| portability | btc | `{"network":"bitcoin"}` | 32 | pass |
| portability | btc | `{"network":"testnet"}` | 32 | pass |
| portability | btc | `{"bip":44}` | 32 | **32 fail** |
| portability | btc | `{"bip":44,"network":"bitcoin"}` | 32 | pass |
| portability | solana | `{}` | 32 | pass |
| portability | ton | `{}` | 32 | pass |
| portability | tron | `{}` | 32 | pass |
| portability | aptos | `{}` | 32 | pass |
| paths | evm |  | 60 | pass |
| paths | btc |  | 60 | pass |
| paths | solana |  | 60 | pass |
| paths | ton |  | 60 | pass |
| paths | tron |  | 60 | pass |
| paths | aptos |  | 60 | pass |
| path-hygiene | evm |  | 4 | **2 fail** |
| path-hygiene | btc |  | 4 | **4 fail** |
| path-hygiene | solana |  | 3 | **1 fail** |
| path-hygiene | ton |  | 3 | **3 fail** |
| path-hygiene | tron |  | 4 | **2 fail** |
| path-hygiene | aptos |  | 2 | **1 fail** |
| config | btc |  | 4 | **4 fail** |
| signatures | evm |  | 18 | pass |
| signatures | btc |  | 18 | pass |
| signatures | solana |  | 18 | pass |
| signatures | ton |  | 18 | pass |
| signatures | tron |  | 18 | pass |
| signatures | aptos |  | 18 | pass |
| evm-bip32 | evm |  | 517 | pass |

## First failure of each failing check

### portability / btc {}

```json
{
  "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  "account": 0,
  "expectedPath": "m/84'/0'/0'/0/0",
  "wdkPath": "m/84'/1'/0'/0/0",
  "expected": "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
  "actual": "bc1q6rz28mcfaxtmd6v789l9rrlrusdprr9p276ldv"
}
```

### portability / btc {"bip":44}

```json
{
  "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  "account": 0,
  "expectedPath": "m/44'/0'/0'/0/0",
  "wdkPath": "m/44'/1'/0'/0/0",
  "expected": "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA",
  "actual": "16JcQVoL61QsLCPS6ek8UJZ52eRfaFqLJt"
}
```

### path-hygiene / evm

```json
{
  "input": "0'/0/01",
  "issue": "leading zero aliases another path",
  "accepted": true,
  "reportedPath": "m/44'/60'/0'/0/1",
  "derivedSameKeyAs": "m/44'/60'/0'/0/1"
}
```

### path-hygiene / btc

```json
{
  "input": "0'/0/01",
  "issue": "leading zero aliases another path",
  "accepted": true,
  "reportedPath": "m/84'/0'/0'/0/01",
  "derivedSameKeyAs": "m/84'/0'/0'/0/1",
  "index": 1
}
```

### path-hygiene / solana

```json
{
  "input": "00'/0'",
  "issue": "leading zero aliases another path",
  "accepted": true,
  "reportedPath": "m/44'/501'/00'/0'",
  "derivedSameKeyAs": "m/44'/501'/0'/0'"
}
```

### path-hygiene / ton

```json
{
  "input": "00'",
  "issue": "leading zero aliases another path",
  "accepted": true,
  "reportedPath": "m/44'/607'/00'",
  "derivedSameKeyAs": "m/44'/607'/0'",
  "index": 0
}
```

### path-hygiene / tron

```json
{
  "input": "0'/0/01",
  "issue": "leading zero aliases another path",
  "accepted": true,
  "reportedPath": "m/44'/195'/0'/0/01",
  "derivedSameKeyAs": "m/44'/195'/0'/0/1"
}
```

### path-hygiene / aptos

```json
{
  "input": "00'/0'/0'",
  "issue": "leading zero aliases another path",
  "accepted": true,
  "reportedPath": "m/44'/637'/0'/0'/0'",
  "derivedSameKeyAs": "m/44'/637'/0'/0'/0'",
  "index": 0
}
```

### config / btc

```json
{
  "config": {
    "network": "mainnet"
  },
  "issue": "unknown network name accepted",
  "wdkPath": "m/84'/1'/0'/0/0",
  "address": "bc1q6rz28mcfaxtmd6v789l9rrlrusdprr9p276ldv",
  "bip84MainnetAddress": "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
  "matchesCoinType1": true
}
```

