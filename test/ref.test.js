// The reference implementation must reproduce the official vectors before it is allowed to
// judge anything else.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as ref from '../src/ref.js'

const load = (f) => JSON.parse(readFileSync(new URL(`../vectors/${f}`, import.meta.url)))

test('BIP-32 official vectors 1-4 (xprv at every chain)', () => {
  const { vectors } = load('bip32.json')
  let n = 0
  for (const v of vectors) {
    const seed = ref.hex.decode(v.seed)
    for (const c of v.chains) {
      const idx = ref.parsePath(c.path)
      let node = ref.bip32Master(seed)
      let parent = null
      for (const i of idx) { parent = node; node = ref.bip32Child(node, i) }
      const fp = parent ? ref.fingerprint(parent) : new Uint8Array(4)
      assert.equal(ref.serializeXprv(node, idx.length, fp, idx.at(-1) ?? 0), c.xprv, c.path)
      n++
    }
  }
  assert.equal(n, 17)
})

test('SLIP-0010 ed25519 official vectors 1-2', () => {
  const { vectors } = load('slip10-ed25519.json')
  for (const v of vectors) {
    for (const c of v.chains) {
      const k = ref.slip10Derive(ref.hex.decode(v.seed), c.path)
      assert.equal(ref.hex.encode(k.key), c.private, c.path)
      assert.equal(ref.hex.encode(k.chainCode), c.chainCode, c.path)
      assert.equal(ref.hex.encode(k.publicKey), c.public, c.path)
    }
  }
})

test('BIP-84 official vectors', () => {
  const seed = ref.mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
  const addr = (p) => ref.p2wpkh(ref.bip32Derive(seed, p).publicKey)
  assert.equal(addr("m/84'/0'/0'/0/0"), 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu')
  assert.equal(addr("m/84'/0'/0'/0/1"), 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g')
  assert.equal(addr("m/84'/0'/0'/1/0"), 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el')
})

test('strict path grammar', () => {
  for (const bad of ["m/01", "m/2147483648", "m/0''", "m/ 1", "m/1e3", "m/0x10", "0/1", "m/-1"]) {
    assert.throws(() => ref.parsePath(bad), bad)
  }
  assert.deepEqual(ref.parsePath("m/0'/2147483647h"), [0x80000000, 0xffffffff])
})
