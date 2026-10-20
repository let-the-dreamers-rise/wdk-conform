// One adapter per WDK wallet module. Each adapter knows:
//   - how to build a WDK account (the system under test),
//   - the derivation convention the chain's mainstream wallets use, so a seed moved between
//     a WDK app and those wallets shows the same funds,
//   - how to compute the expected address and verify a signature with src/ref.js only.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import WalletManagerBtc from '@tetherto/wdk-wallet-btc'
import WalletManagerSolana from '@tetherto/wdk-wallet-solana'
import WalletManagerTon from '@tetherto/wdk-wallet-ton'
import WalletManagerTron from '@tetherto/wdk-wallet-tron'
import WalletManagerAptos from '@tetherto/wdk-wallet-aptos'
import { WalletContractV5R1 } from '@ton/ton'
import { sha256 } from '@noble/hashes/sha256'
import * as ref from './ref.js'

const require = createRequire(import.meta.url)
// package.json is not in the modules' exports map, so read it next to the resolved entry point.
export const versionOf = (pkg) => JSON.parse(readFileSync(require.resolve(pkg).replace(/index\.js$/, 'package.json'))).version

const enc = new TextEncoder()

const tonSafeSignHash = (message) =>
  sha256(ref.concat(new Uint8Array([0xff, 0xff]), enc.encode('ton-safe-sign-magic'), enc.encode(message)))

export const chains = [
  {
    id: 'evm',
    pkg: '@tetherto/wdk-wallet-evm',
    Manager: WalletManagerEvm,
    curve: 'secp256k1',
    prefix: "m/44'/60'",
    accountPath: (i) => `0'/0/${i}`,
    wallets: 'MetaMask, Rabby, Ledger Live (m/44\'/60\'/0\'/0/i)',
    address: (seed, path) => ref.evmAddress(ref.bip32Derive(seed, path).publicKey),
    verify: (msg, sig, addr) => ref.eip191Recover(msg, sig)?.address === addr
  },
  {
    id: 'btc',
    pkg: '@tetherto/wdk-wallet-btc',
    Manager: WalletManagerBtc,
    curve: 'secp256k1',
    // BIP-84 (default) / BIP-44; coin type 0' on mainnet, 1' on test networks (SLIP-0044).
    prefix: (cfg) => `m/${cfg.bip ?? 84}'/${(cfg.network ?? 'bitcoin') === 'bitcoin' ? 0 : 1}'`,
    accountPath: (i) => `0'/0/${i}`,
    wallets: 'Sparrow, Electrum, BlueWallet, Ledger Live (m/84\'/0\'/0\'/0/i)',
    address: (seed, path, cfg = {}) => {
      const pub = ref.bip32Derive(seed, path).publicKey
      return (cfg.bip ?? 84) === 44 ? ref.p2pkh(pub, cfg.network ?? 'bitcoin') : ref.p2wpkh(pub, cfg.network ?? 'bitcoin')
    },
    verify: (msg, sig, addr, cfg = {}) => ref.bip137Recover(msg, sig, cfg.network ?? 'bitcoin')?.address === addr,
    configs: [{}, { network: 'bitcoin' }, { network: 'testnet' }, { bip: 44 }, { bip: 44, network: 'bitcoin' }]
  },
  {
    id: 'solana',
    pkg: '@tetherto/wdk-wallet-solana',
    Manager: WalletManagerSolana,
    curve: 'ed25519',
    prefix: "m/44'/501'",
    accountPath: (i) => `${i}'/0'`,
    wallets: 'Phantom, Solflare, Backpack (m/44\'/501\'/i\'/0\')',
    address: (seed, path) => ref.solanaAddress(ref.slip10Derive(seed, path).publicKey),
    verify: (msg, sig, addr, cfg, pub) => ref.ed25519Verify(sig, enc.encode(msg), pub)
  },
  {
    id: 'ton',
    pkg: '@tetherto/wdk-wallet-ton',
    Manager: WalletManagerTon,
    curve: 'ed25519',
    prefix: "m/44'/607'",
    accountPath: (i) => `${i}'`,
    wallets: 'Trust Wallet, other BIP-39 TON wallets (m/44\'/607\'/i\', wallet v5r1)',
    address: (seed, path) => {
      const { publicKey } = ref.slip10Derive(seed, path)
      return WalletContractV5R1.create({ workchain: 0, publicKey: Buffer.from(publicKey) }).address.toString({ bounceable: false })
    },
    // WDK's own documented scheme: ed25519 over sha256(0xffff || "ton-safe-sign-magic" || message).
    verify: (msg, sig, addr, cfg, pub) => ref.ed25519Verify(sig, tonSafeSignHash(msg), pub)
  },
  {
    id: 'tron',
    pkg: '@tetherto/wdk-wallet-tron',
    Manager: WalletManagerTron,
    curve: 'secp256k1',
    prefix: "m/44'/195'",
    accountPath: (i) => `0'/0/${i}`,
    wallets: 'TronLink, Trust Wallet (m/44\'/195\'/0\'/0/i)',
    address: (seed, path) => ref.tronAddress(ref.bip32Derive(seed, path).publicKey),
    verify: (msg, sig, addr) => ref.tronV2Recover(msg, sig)?.address === addr
  },
  {
    id: 'aptos',
    pkg: '@tetherto/wdk-wallet-aptos',
    Manager: WalletManagerAptos,
    curve: 'ed25519',
    prefix: "m/44'/637'",
    accountPath: (i) => `${i}'/0'/0'`,
    wallets: 'Petra, Pontem (m/44\'/637\'/i\'/0\'/0\')',
    address: (seed, path) => ref.aptosAddress(ref.slip10Derive(seed, path).publicKey),
    verify: (msg, sig, addr, cfg, pub) => ref.ed25519Verify(sig, enc.encode(msg), pub)
  }
]

export const prefixOf = (chain, cfg = {}) => typeof chain.prefix === 'function' ? chain.prefix(cfg) : chain.prefix
