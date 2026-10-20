// Independent reference implementations, written from the specs.
//
// Nothing here imports the HD-key, address or message-signing code that the WDK modules use
// (bip32, bitcoinjs-lib, bitcoinjs-message, micro-key-producer, ethers, tronweb). Only the
// audited primitives from @noble and @scure are used: curves, hashes and base encodings.
// src/ref.test.js checks every function below against the official test vectors first.

import { secp256k1 } from '@noble/curves/secp256k1'
import { ed25519 } from '@noble/curves/ed25519'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
import { ripemd160 } from '@noble/hashes/ripemd160'
import { keccak_256, sha3_256 } from '@noble/hashes/sha3'
import { base58, base58check as b58c, bech32, hex } from '@scure/base'
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

const base58check = b58c(sha256)
const N = secp256k1.CURVE.n
const H = 0x80000000
const enc = new TextEncoder()

const toBig = (b) => BigInt('0x' + (hex.encode(b) || '0'))
const to32 = (n) => hex.decode(n.toString(16).padStart(64, '0'))
const ser32 = (i) => new Uint8Array([i >>> 24, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff])
const concat = (...a) => {
  const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0))
  let o = 0
  for (const x of a) { out.set(x, o); o += x.length }
  return out
}

export const hash160 = (b) => ripemd160(sha256(b))

export function mnemonicToSeed (mnemonic) {
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error('invalid mnemonic')
  return mnemonicToSeedSync(mnemonic)
}

// BIP-32 path grammar, strict: "m" followed by "/" separated indices, each a decimal number
// with no leading zeros and below 2^31, optionally suffixed by "'" (or "h") for hardened.
export function parsePath (path) {
  const parts = path.split('/')
  if (parts[0] !== 'm') throw new Error(`path must start with m: ${path}`)
  return parts.slice(1).map((c) => {
    const m = /^(0|[1-9][0-9]*)(['h])?$/.exec(c)
    if (!m) throw new Error(`invalid path component: ${c}`)
    const i = Number(m[1])
    if (i >= H) throw new Error(`index out of range: ${c}`)
    return m[2] ? i + H : i
  })
}

// BIP-32 (secp256k1). Returns { key, chainCode, publicKey }.
export function bip32Master (seed) {
  const I = hmac(sha512, enc.encode('Bitcoin seed'), seed)
  const k = toBig(I.slice(0, 32))
  if (k === 0n || k >= N) throw new Error('invalid master key')
  return node(I.slice(0, 32), I.slice(32))
}

function node (key, chainCode) {
  return { key, chainCode, publicKey: secp256k1.getPublicKey(key, true) }
}

export function bip32Child (parent, index) {
  const data = index >= H
    ? concat(new Uint8Array([0]), parent.key, ser32(index))
    : concat(parent.publicKey, ser32(index))
  const I = hmac(sha512, parent.chainCode, data)
  const il = toBig(I.slice(0, 32))
  const k = (il + toBig(parent.key)) % N
  // BIP-32: if IL >= n or the child key is 0, this index is invalid; the caller moves on.
  if (il >= N || k === 0n) throw new Error('invalid child, use next index')
  return node(to32(k), I.slice(32))
}

export function bip32Derive (seed, path) {
  return parsePath(path).reduce(bip32Child, bip32Master(seed))
}

// SLIP-0010 (ed25519): hardened derivation only.
export function slip10Derive (seed, path) {
  let I = hmac(sha512, enc.encode('ed25519 seed'), seed)
  for (const index of parsePath(path)) {
    if (index < H) throw new Error('SLIP-0010 ed25519 supports hardened indices only')
    I = hmac(sha512, I.slice(32), concat(new Uint8Array([0]), I.slice(0, 32), ser32(index)))
  }
  const key = I.slice(0, 32)
  return { key, chainCode: I.slice(32), publicKey: ed25519.getPublicKey(key) }
}

// BIP-32 extended key serialization (for the official vectors).
export function serializeXprv (n, depth, parentFp, index) {
  return base58check.encode(concat(hex.decode('0488ade4'), new Uint8Array([depth]), parentFp, ser32(index), n.chainCode, new Uint8Array([0]), n.key))
}
export function fingerprint (n) { return hash160(n.publicKey).slice(0, 4) }

// ---- Address encoders ----

export function evmAddress (compressedPub) {
  const pub = secp256k1.ProjectivePoint.fromHex(compressedPub).toRawBytes(false).slice(1)
  const addr = hex.encode(keccak_256(pub).slice(-20))
  const h = hex.encode(keccak_256(enc.encode(addr)))
  return '0x' + [...addr].map((c, i) => parseInt(h[i], 16) >= 8 ? c.toUpperCase() : c).join('')
}

export function tronAddress (compressedPub) {
  const pub = secp256k1.ProjectivePoint.fromHex(compressedPub).toRawBytes(false).slice(1)
  return base58check.encode(concat(new Uint8Array([0x41]), keccak_256(pub).slice(-20)))
}

const HRP = { bitcoin: 'bc', testnet: 'tb', regtest: 'bcrt' }
const P2PKH = { bitcoin: 0x00, testnet: 0x6f, regtest: 0x6f }

export function p2wpkh (compressedPub, network = 'bitcoin') {
  const words = bech32.toWords(hash160(compressedPub))
  return bech32.encode(HRP[network], [0, ...words])
}
export function p2pkh (compressedPub, network = 'bitcoin') {
  return base58check.encode(concat(new Uint8Array([P2PKH[network]]), hash160(compressedPub)))
}

export const solanaAddress = (pub) => base58.encode(pub)
export const aptosAddress = (pub) => '0x' + hex.encode(sha3_256(concat(pub, new Uint8Array([0]))))

// ---- Message signatures ----

function varint (n) {
  if (n < 0xfd) return new Uint8Array([n])
  if (n <= 0xffff) return new Uint8Array([0xfd, n & 0xff, n >> 8])
  return new Uint8Array([0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24])
}

// Bitcoin "signmessage" digest (Bitcoin Core / BIP-137).
export function bitcoinMessageHash (message) {
  const prefix = enc.encode('\x18Bitcoin Signed Message:\n')
  const m = enc.encode(message)
  return sha256(sha256(concat(prefix, varint(m.length), m)))
}

// Verifies a BIP-137 signature and returns the address it proves, or null.
// Header 27-30 P2PKH uncompressed, 31-34 P2PKH compressed, 35-38 P2SH-P2WPKH, 39-42 P2WPKH.
export function bip137Recover (message, signatureB64, network = 'bitcoin') {
  const sig = Uint8Array.from(Buffer.from(signatureB64, 'base64'))
  if (sig.length !== 65) return null
  const header = sig[0]
  if (header < 27 || header > 42) return null
  const recovery = (header - 27) & 3
  const s = secp256k1.Signature.fromCompact(sig.slice(1)).addRecoveryBit(recovery)
  const point = s.recoverPublicKey(bitcoinMessageHash(message))
  const pub = point.toRawBytes(true)
  if (header >= 39) return { type: 'p2wpkh', address: p2wpkh(pub, network) }
  if (header >= 35) return { type: 'p2sh-p2wpkh', address: null }
  if (header >= 31) return { type: 'p2pkh', address: p2pkh(pub, network) }
  return { type: 'p2pkh-uncompressed', address: null }
}

// EIP-191 personal_sign. Returns the recovered checksummed address.
export function eip191Recover (message, signatureHex) {
  const m = enc.encode(message)
  const digest = keccak_256(concat(enc.encode(`\x19Ethereum Signed Message:\n${m.length}`), m))
  return recover65(digest, signatureHex, evmAddress)
}

// TRON signMessageV2 (TIP-191 style prefix).
export function tronV2Recover (message, signatureHex) {
  const m = enc.encode(message)
  const digest = keccak_256(concat(enc.encode(`\x19TRON Signed Message:\n${m.length}`), m))
  return recover65(digest, signatureHex, tronAddress)
}

function recover65 (digest, signatureHex, toAddress) {
  const b = hex.decode(signatureHex.replace(/^0x/, ''))
  if (b.length !== 65) return null
  const v = b[64] >= 27 ? b[64] - 27 : b[64]
  const s = secp256k1.Signature.fromCompact(b.slice(0, 64))
  if (s.hasHighS()) return { address: null, highS: true }
  const pub = s.addRecoveryBit(v).recoverPublicKey(digest).toRawBytes(true)
  return { address: toAddress(pub), highS: false }
}

export const ed25519Verify = (sigHex, msgBytes, pub) => ed25519.verify(hex.decode(sigHex.replace(/^0x/, '')), msgBytes, pub)

export { hex, concat, H }
