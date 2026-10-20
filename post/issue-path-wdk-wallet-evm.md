`getAccountByPath` accepts path strings that BIP-32 tooling treats as invalid or ambiguous, and derives a key that a different, canonical path string also names. Sometimes the account's `path` and `index` then describe a key the account does not hold. `@tetherto/wdk-wallet-aptos` already rejects these on purpose ("so distinct path strings cannot alias the same derived key"). This brings the other modules in line.

Found with [wdk-conform](https://github.com/let-the-dreamers-rise/wdk-conform) (`path-hygiene` check). Seed for all examples: `abandon ×11 about`.

**tetherto/wdk-wallet-evm** (`1.0.0-beta.22`): `0'/0/01` is accepted as `0'/0/1`, and `index` is `undefined` for `0'/0/0'`.
