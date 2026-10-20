One issue per repo. Paste the shared body, then the repo's section.

---

Title: getAccountByPath accepts ambiguous paths that alias other keys

**Shared body**

`getAccountByPath` accepts path strings that BIP-32 tooling treats as invalid or ambiguous, and derives a key that a different, canonical path string also names. Sometimes the account's `path` and `index` then describe a key the account does not hold. `@tetherto/wdk-wallet-aptos` already rejects these on purpose ("so distinct path strings cannot alias the same derived key"). This brings the other modules in line.

Found with [wdk-conform](https://github.com/let-the-dreamers-rise/wdk-conform) (`path-hygiene` check). Seed for all examples: `abandon ×11 about`.

---

**tetherto/wdk-wallet-btc** (`1.0.0-beta.17`, `network: 'bitcoin'`)

| input | reported `path` | key actually derived | `index` |
|---|---|---|---|
| `0'/0/01` | `m/84'/0'/0'/0/01` | `m/84'/0'/0'/0/1` | 1 |
| `0'/0/2147483648` | `m/84'/0'/0'/0/2147483648` | `m/84'/0'/0'/0/0'` | 2147483648 |
| `0'/0/4294967295` | `m/84'/0'/0'/0/4294967295` | `m/84'/0'/0'/0/2147483647'` | 4294967295 |
| `0'/0/0'` | `m/84'/0'/0'/0/0'` | (correct) | `NaN` |

Suggested: validate each segment with `/^(0|[1-9]\d*)'?$/` and value < 2^31; parse `index` with the hardened marker stripped.

**tetherto/wdk-wallet-ton** (`1.0.0-beta.16`)

| input | reported `path` | key actually derived |
|---|---|---|
| `0` | `m/44'/607'/0` | `m/44'/607'/0'` |
| `0'/0` | `m/44'/607'/0'/0` | `m/44'/607'/0'/0'` |
| `00'` | `m/44'/607'/00'` | `m/44'/607'/0'` |

`derive(path, true)` forces hardening. SLIP-0010 ed25519 has no unhardened derivation, so reject unhardened segments, as wdk-wallet-solana and wdk-wallet-aptos do.

**tetherto/wdk-wallet-evm** (`1.0.0-beta.22`): `0'/0/01` is accepted as `0'/0/1`, and `index` is `undefined` for `0'/0/0'`.

**tetherto/wdk-wallet-tron** (`1.0.0-beta.15`): `0'/0/01` is accepted (reported `m/44'/195'/0'/0/01`, derives `0'/0/1`), and `index` is `NaN` for `0'/0/0'`.

**tetherto/wdk-wallet-solana** (`1.0.0-beta.18`): `00'/0'` is accepted (reported `m/44'/501'/00'/0'`, derives `0'/0'`).
