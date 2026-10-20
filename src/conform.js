// The conformance checks. Each check returns { id, chain, cases, failures: [{ ...evidence }] }.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { sha256 } from '@noble/hashes/sha256'
import { entropyToMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import * as ref from './ref.js'
import { chains, prefixOf } from './chains.js'

const require = createRequire(import.meta.url)

// Deterministic randomness, so every run and every CI job sees the same cases.
export function rng (label) {
  let counter = 0
  let pool = new Uint8Array(0)
  const bytes = (n) => {
    while (pool.length < n) pool = ref.concat(pool, sha256(new TextEncoder().encode(`${label}/${counter++}`)))
    const out = pool.slice(0, n)
    pool = pool.slice(n)
    return out
  }
  const int = (max) => Number(BigInt('0x' + ref.hex.encode(bytes(6))) % BigInt(max))
  return { bytes, int }
}

export function mnemonics (n, label = 'mnemonics') {
  const r = rng(label)
  const out = ['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about']
  while (out.length < n) out.push(entropyToMnemonic(r.bytes([16, 20, 24, 28, 32][out.length % 5]), wordlist))
  return out
}

// Path checks pin the network explicitly, so the BTC default-network bug (see portability) does
// not mask path handling problems.
const pinned = (chain) => chain.id === 'btc' ? { network: 'bitcoin' } : {}

const accountOf = async (chain, mnemonic, cfg, relPath) => {
  const manager = new chain.Manager(mnemonic, cfg)
  return relPath === undefined ? manager : await manager.getAccountByPath(relPath)
}

// 1. A seed restores to the addresses the chain's mainstream wallets show.
export async function portability ({ seeds = 8, accounts = 4 } = {}) {
  const results = []
  for (const chain of chains) {
    for (const cfg of chain.configs ?? [{}]) {
      const r = { id: 'portability', chain: chain.id, config: cfg, cases: 0, failures: [] }
      for (const m of mnemonics(seeds)) {
        const seed = ref.mnemonicToSeed(m)
        const manager = new chain.Manager(m, cfg)
        for (let i = 0; i < accounts; i++) {
          const account = await manager.getAccount(i)
          const path = `${prefixOf(chain, cfg)}/${chain.accountPath(i)}`
          const expected = chain.address(seed, path, cfg)
          const actual = await account.getAddress()
          r.cases++
          if (actual !== expected || account.path !== path) {
            r.failures.push({ mnemonic: m, account: i, expectedPath: path, wdkPath: account.path, expected, actual })
          }
        }
      }
      results.push(r)
    }
  }
  return results
}

// 2. getAccountByPath agrees with the reference for random valid paths.
export async function paths ({ cases = 60 } = {}) {
  const results = []
  for (const chain of chains) {
    const r = { id: 'paths', chain: chain.id, cases: 0, failures: [] }
    const rand = rng(`paths/${chain.id}`)
    const m = mnemonics(3)[rand.int(3)]
    const seed = ref.mnemonicToSeed(m)
    for (let k = 0; k < cases; k++) {
      const len = chain.id === 'aptos' ? 3 : 1 + rand.int(4)
      const segs = []
      for (let j = 0; j < len; j++) {
        const big = rand.int(4) === 0
        const idx = big ? 0x7fffffff - rand.int(1000) : rand.int(20)
        const hardened = chain.curve === 'ed25519' || (j === 0) || rand.int(2) === 0
        segs.push(`${idx}${hardened ? "'" : ''}`)
      }
      const rel = segs.join('/')
      const path = `${prefixOf(chain)}/${rel}`
      r.cases++
      try {
        const account = await accountOf(chain, m, pinned(chain), rel)
        const expected = chain.address(seed, path, pinned(chain))
        const actual = await account.getAddress()
        if (actual !== expected) r.failures.push({ path, expected, actual })
      } catch (e) {
        r.failures.push({ path, error: e.message })
      }
    }
    results.push(r)
  }
  return results
}

// 3. Malformed or ambiguous path strings must be rejected. If WDK accepts one, find out which
//    key it really derived and whether the path it reports matches that key.
const HYGIENE = {
  secp256k1: [
    ["0'/0/01", "0'/0/1", 'leading zero aliases another path'],
    ["0'/0/2147483648", "0'/0/0'", 'index >= 2^31 written without the hardened marker'],
    ["0'/0/4294967295", "0'/0/2147483647'", 'index >= 2^31 written without the hardened marker'],
    ["0'/0/0'", null, 'valid path; index getter should not be NaN']
  ],
  ed25519: [
    ["00'", "0'", 'leading zero aliases another path'],
    ["0", "0'", 'non-hardened index on an ed25519 (hardened-only) chain'],
    ["0'/0", "0'/0'", 'non-hardened index on an ed25519 (hardened-only) chain']
  ]
}

export async function pathHygiene () {
  const m = mnemonics(1)[0]
  const seed = ref.mnemonicToSeed(m)
  const results = []
  for (const chain of chains) {
    const r = { id: 'path-hygiene', chain: chain.id, cases: 0, failures: [] }
    for (const [input, canonical, why] of HYGIENE[chain.curve]) {
      let rel = input
      let canon = canonical
      if (chain.id === 'solana') { rel = `${input}/0'`.replace("''", "'"); canon = canonical && `${canonical}/0'` }
      if (chain.id === 'aptos') { rel = `${input}/0'/0'`; canon = canonical && `${canonical}/0'/0'` }
      if (chain.id === 'aptos' && rel.split('/').length !== 3) continue
      r.cases++
      let account
      try { account = await accountOf(chain, m, pinned(chain), rel) } catch { continue } // rejected: correct
      const actual = await account.getAddress()
      if (canon === null) {
        if (!Number.isInteger(account.index)) r.failures.push({ input: rel, issue: 'index getter is not an integer', index: account.index, path: account.path })
        continue
      }
      const canonPath = `${prefixOf(chain)}/${canon}`
      const aliased = actual === chain.address(seed, canonPath, pinned(chain))
      r.failures.push({
        input: rel,
        issue: why,
        accepted: true,
        reportedPath: account.path,
        derivedSameKeyAs: aliased ? canonPath : 'unknown',
        index: account.index
      })
    }
    results.push(r)
  }
  return results
}

// 4. Misconfiguration must fail loudly instead of silently deriving something else.
export async function config () {
  const m = mnemonics(1)[0]
  const seed = ref.mnemonicToSeed(m)
  const btc = chains.find((c) => c.id === 'btc')
  const r = { id: 'config', chain: 'btc', cases: 0, failures: [] }
  for (const network of ['mainnet', 'Bitcoin', 'livenet', 'main']) {
    r.cases++
    let account
    try { account = await (new btc.Manager(m, { network })).getAccount(0) } catch { continue }
    const address = await account.getAddress()
    r.failures.push({
      config: { network },
      issue: 'unknown network name accepted',
      wdkPath: account.path,
      address,
      bip84MainnetAddress: btc.address(seed, "m/84'/0'/0'/0/0", {}),
      matchesCoinType1: address === btc.address(seed, "m/84'/1'/0'/0/0", {})
    })
  }
  return [r]
}

// 5. Message signatures verify with an independent verifier for the chain's standard scheme.
const MESSAGES = ['', 'hello', 'héllo wörld 👋', 'line1\nline2', 'x'.repeat(300), '0x1234']

export async function signatures () {
  const results = []
  for (const chain of chains) {
    const r = { id: 'signatures', chain: chain.id, cases: 0, failures: [] }
    for (const m of mnemonics(3)) {
      const seed = ref.mnemonicToSeed(m)
      const account = await (new chain.Manager(m, {})).getAccount(0)
      const path = `${prefixOf(chain)}/${chain.accountPath(0)}`
      const pub = chain.curve === 'ed25519' ? ref.slip10Derive(seed, path).publicKey : null
      const addr = await account.getAddress()
      for (const msg of MESSAGES) {
        r.cases++
        try {
          const sig = await account.sign(msg)
          if (!chain.verify(msg, sig, addr, {}, pub)) r.failures.push({ message: msg.slice(0, 40), signature: sig })
        } catch (e) {
          r.failures.push({ message: msg.slice(0, 40), error: e.message })
        }
      }
    }
    results.push(r)
  }
  return results
}

// 6. The EVM module ships its own BIP-32 implementation (src/memory-safe/hd-node-wallet.js).
//    Check it directly against the official vectors and against the reference on random input.
export async function evmBip32 ({ fuzz = 500 } = {}) {
  // Not exported by the package, so load it by file path.
  const file = require.resolve('@tetherto/wdk-wallet-evm').replace(/index\.js$/, 'src/memory-safe/hd-node-wallet.js')
  const { default: HD } = await import(pathToFileURL(file))
  const r = { id: 'evm-bip32', chain: 'evm', cases: 0, failures: [] }
  const vectors = JSON.parse(readFileSync(new URL('../vectors/bip32.json', import.meta.url))).vectors
  const check = (seed, path, label) => {
    r.cases++
    const want = ref.hex.encode(ref.bip32Derive(seed, path).key)
    let got
    try { got = ref.hex.encode(HD.fromSeed(seed).derivePath(path).privateKeyBuffer) } catch (e) { got = `error: ${e.message}` }
    if (got !== want) r.failures.push({ label, seed: ref.hex.encode(seed), path, want, got })
  }
  for (const v of vectors) for (const c of v.chains) check(ref.hex.decode(v.seed), c.path, 'bip32 vector')
  const rand = rng('evm-bip32')
  for (let k = 0; k < fuzz; k++) {
    const seed = rand.bytes(16 + rand.int(49))
    const depth = 1 + rand.int(6)
    const segs = ['m']
    for (let j = 0; j < depth; j++) segs.push(`${rand.int(3) === 0 ? 0x7fffffff - rand.int(10) : rand.int(100)}${rand.int(2) ? "'" : ''}`)
    check(seed, segs.join('/'), 'fuzz')
  }
  return [r]
}

export const ALL = { portability, paths, pathHygiene, config, signatures, evmBip32 }
