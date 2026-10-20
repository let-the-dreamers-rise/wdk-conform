`getAccountByPath` accepts path strings that BIP-32 tooling treats as invalid or ambiguous, and derives a key that a different, canonical path string also names. Sometimes the account's `path` and `index` then describe a key the account does not hold. `@tetherto/wdk-wallet-aptos` already rejects these on purpose ("so distinct path strings cannot alias the same derived key"). This brings the other modules in line.

Found with [wdk-conform](https://github.com/let-the-dreamers-rise/wdk-conform) (`path-hygiene` check). Seed for all examples: `abandon ×11 about`.

**tetherto/wdk-wallet-btc** (`1.0.0-beta.17`, `network: 'bitcoin'`)

| input | reported `path` | key actually derived | `index` |
|---|---|---|---|
| `0'/0/01` | `m/84'/0'/0'/0/01` | `m/84'/0'/0'/0/1` | 1 |
| `0'/0/2147483648` | `m/84'/0'/0'/0/2147483648` | `m/84'/0'/0'/0/0'` | 2147483648 |
| `0'/0/4294967295` | `m/84'/0'/0'/0/4294967295` | `m/84'/0'/0'/0/2147483647'` | 4294967295 |
| `0'/0/0'` | `m/84'/0'/0'/0/0'` | (correct) | `NaN` |

Suggested: validate each segment with `/^(0|[1-9]\d*)'?$/` and value < 2^31; parse `index` with the hardened marker stripped.
