`getAccountByPath` accepts path strings that BIP-32 tooling treats as invalid or ambiguous, and derives a key that a different, canonical path string also names. Sometimes the account's `path` and `index` then describe a key the account does not hold. `@tetherto/wdk-wallet-aptos` already rejects these on purpose ("so distinct path strings cannot alias the same derived key"). This brings the other modules in line.

Found with [wdk-conform](https://github.com/let-the-dreamers-rise/wdk-conform) (`path-hygiene` check). Seed for all examples: `abandon ×11 about`.

**tetherto/wdk-wallet-ton** (`1.0.0-beta.16`)

| input | reported `path` | key actually derived |
|---|---|---|
| `0` | `m/44'/607'/0` | `m/44'/607'/0'` |
| `0'/0` | `m/44'/607'/0'/0` | `m/44'/607'/0'/0'` |
| `00'` | `m/44'/607'/00'` | `m/44'/607'/0'` |

`derive(path, true)` forces hardening. SLIP-0010 ed25519 has no unhardened derivation, so reject unhardened segments, as wdk-wallet-solana and wdk-wallet-aptos do.
