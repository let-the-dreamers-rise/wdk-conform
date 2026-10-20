**Summary**

When `network` is omitted (documented default: `"bitcoin"`), the module derives keys under coin type `1'` (testnet) but encodes mainnet `bc1` addresses. A user who restores the seed in Sparrow, Electrum, BlueWallet or Ledger Live sees an empty wallet. Misspelled network names (`"mainnet"`, `"livenet"`) are accepted silently and land in the same state.

**Reproduce** (npm `1.0.0-beta.17`; `main` has the same logic in `getBtcDerivationPathPrefix`)

```js
import WalletManagerBtc from '@tetherto/wdk-wallet-btc'
const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const account = await new WalletManagerBtc(seed, {}).getAccount(0)
console.log(account.path, await account.getAddress())
// m/84'/1'/0'/0/0 bc1q6rz28mcfaxtmd6v789l9rrlrusdprr9p276ldv
```

The [BIP-84 test vector](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki#test-vectors) for this seed is `m/84'/0'/0'/0/0` → `bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu`, which WDK only returns with an explicit `network: 'bitcoin'`. The same happens with `bip: 44` (`m/44'/1'`).

**Cause**

- Coin type: `config.network === 'bitcoin' ? 0 : 1` gives `1'` when `network` is undefined (`src/wallet-account-btc.js:123` on the release, `src/signers/seed-signer-btc.js` on `main`).
- Address: `networks[config.network] || networks.bitcoin` gives mainnet when `network` is undefined.

The unit fixtures pin this behaviour: `COIN_NODE_PATH = "m/84'/1'"` is labelled "the default configuration" while the same test asserts `signer.network === 'bitcoin'`.

**Fix**

Default `network` to `'bitcoin'` before choosing the coin type, and throw `ValueError` for names other than `bitcoin`, `testnet` and `regtest`. A patch with updated fixtures and two regression tests (one is the BIP-84 vector) is attached as a PR. The unit suite shows no new failures.

**Migration**

This changes the default addresses. Apps that shipped with the default config hold user funds under `m/84'/1'`, so after upgrading they should scan or sweep that path once. Worth a line in the release notes.

Found with [wdk-conform](https://github.com/let-the-dreamers-rise/wdk-conform), an independent seed-portability test suite for WDK wallet modules.
