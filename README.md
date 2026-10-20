# wdk-conform

Seed-portability and signature conformance tests for Tether's
[Wallet Development Kit](https://docs.wdk.tether.io) wallet modules.

A self-custodial wallet makes one promise above all others: the seed phrase is the wallet.
If a user restores that seed in MetaMask, Sparrow, Phantom, TronLink or Petra, they must see
the same addresses and the same funds. `wdk-conform` checks that promise for every WDK wallet
module on every release, against an independent reference implementation and the official
test vectors.

It has already found that `@tetherto/wdk-wallet-btc` with its default config derives mainnet
addresses under the testnet coin type, so those seeds restore to an empty wallet anywhere
else. See [FINDINGS.md](FINDINGS.md).

## What it checks

| Check | Question | Cases |
|---|---|---|
| `portability` | Does `getAccount(i)` give the address that the chain's mainstream wallets show for that seed? | 8 seeds × 4 accounts × every config |
| `paths` | Does `getAccountByPath(p)` match the reference for random valid paths, including indices near 2^31? | 60 per chain |
| `path-hygiene` | Are malformed or ambiguous paths rejected instead of aliased, and do `path` and `index` tell the truth? | per chain |
| `config` | Do misspelled options fail loudly instead of silently deriving something else? | btc |
| `signatures` | Does `sign()` output verify with an independent verifier for the chain's scheme? Includes empty, unicode and >253-byte messages | 18 per chain |
| `evm-bip32` | Does the EVM module's own BIP-32 code match all official BIP-32 vectors and 500 random cases? | 517 |

Chains: EVM, Bitcoin (BIP-84 and BIP-44, mainnet and testnet), Solana, TON, TRON, Aptos.

## How it stays independent

`src/ref.js` is written from the BIPs and SLIPs and uses only audited primitives
(`@noble/curves`, `@noble/hashes`, `@scure/base`, `@scure/bip39`). It imports none of the
HD-key, address or message libraries the WDK modules use (`bip32`, `bitcoinjs-lib`,
`bitcoinjs-message`, `micro-key-producer`, `ethers`, `tronweb`). Before it judges anything,
`test/ref.test.js` checks it against:

- all BIP-32 test vectors 1-4 (17 extended private keys),
- the SLIP-0010 ed25519 vectors 1-2,
- the BIP-84 vectors.

Vectors are extracted from the upstream spec repositories by `tools/extract-vectors.mjs`, and
each file records the commit it came from. Random cases come from a seeded generator, so every
run sees the same inputs.

## Run it

```sh
npm ci
npm test                                         # reference self-test against official vectors
npm run conform                                  # full report in report/REPORT.md, exit 1 on any failure
node src/cli.js --baseline known-findings.json   # CI mode: fail only on new failures or fixed ones
```

To test the newest WDK releases instead of the pinned ones:

```sh
npm install $(node -p "Object.keys(require('./package.json').dependencies).filter(d => d.startsWith('@tetherto/')).map(d => d + '@latest').join(' ')")
npm run conform
```

CI (`.github/workflows/conform.yml`) runs both on every push and every night, so a WDK release
that breaks portability turns the badge red the next morning.

## Layout

```
src/ref.js            spec-only BIP-32, SLIP-0010, address encoders, message verifiers
src/chains.js         one adapter per WDK module: wallet conventions, expected addresses
src/conform.js        the checks
src/cli.js            runner, report, baseline mode
vectors/              official test vectors (with source commits)
known-findings.json   checks that fail today because of FINDINGS.md
```

## License

Apache-2.0, the same as WDK.
