# Description
When `network` is omitted (documented default: `"bitcoin"`), the module derives keys under coin type `1'` (testnet) but encodes mainnet `bc1` addresses.

- Coin type: `config.network === 'bitcoin' ? 0 : 1` gives `1'` when `network` is undefined (`src/wallet-account-btc.js:123` on the release, `src/signers/seed-signer-btc.js` on `main`).
- Address: `networks[config.network] || networks.bitcoin` gives mainnet when `network` is undefined.

The unit fixtures pin this behaviour: `COIN_NODE_PATH = "m/84'/1'"` is labelled "the default configuration" while the same test asserts `signer.network === 'bitcoin'`.

This PR defaults `network` to `'bitcoin'` in `getBtcDerivationPathPrefix` before choosing the coin type, and throws `ValueError` for names other than `bitcoin`, `testnet` and `regtest`. Fixtures that pinned the old default are updated, and two regression tests are added: the [BIP-84 test vector](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki#test-vectors) (`abandon ×11 about` → `m/84'/0'/0'/0/0` → `bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu`) and an unknown network name.

## Motivation and Context
Seeds created with the default config do not restore in Sparrow, Electrum, BlueWallet or Ledger Live: those wallets look under `m/84'/0'` and show an empty wallet.

This changes the default addresses. Apps that shipped with the default config hold user funds under `m/84'/1'`, so after upgrading they should scan or sweep that path once. Worth a line in the release notes.

Testing: the regtest tests need Bitcoin Core and Electrs. Without them, the patched and unpatched branches fail the same 70 regtest tests, and this change adds no new failures. All `tests/signers/seed-signer-btc.test.js` tests pass.

## Related Issue
Closes #ISSUE_NUMBER

## Type of change
- [x] Breaking change (fix or feature that would cause existing functionality to not work as expected): the default derivation path changes, see Migration above

Found with [wdk-conform](https://github.com/let-the-dreamers-rise/wdk-conform), an independent seed-portability test suite for WDK wallet modules.
