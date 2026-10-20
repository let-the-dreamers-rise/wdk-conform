// Extracts the official BIP-32 and SLIP-0010 (ed25519) test vectors from local clones of
// github.com/bitcoin/bips and github.com/satoshilabs/slips into vectors/*.json.
// Usage: node tools/extract-vectors.mjs <bips-dir> <slips-dir>
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const [bips, slips] = process.argv.slice(2)
const rev = (d) => execSync('git rev-parse HEAD', { cwd: d }).toString().trim()
const chain = (s) => s.replace(/<sub>H<\/sub>/g, "'").trim()

function bip32 () {
  const text = readFileSync(`${bips}/bip-0032.mediawiki`, 'utf8')
  const out = []
  for (const block of text.split(/===Test vector \d===/).slice(1, 5)) {
    const seed = /Seed \(hex\): ([0-9a-f]+)/.exec(block)[1]
    const chains = [...block.matchAll(/\* Chain (.+)\n\*\* ext pub: (\w+)\n\*\* ext prv: (\w+)/g)]
      .map(([, path, xpub, xprv]) => ({ path: chain(path), xpub, xprv }))
    out.push({ seed, chains })
  }
  return { source: `bitcoin/bips@${rev(bips)} bip-0032.mediawiki`, vectors: out }
}

function slip10 () {
  const text = readFileSync(`${slips}/slip-0010.md`, 'utf8')
  const out = []
  for (const block of text.split(/### Test vector \d for ed25519/).slice(1)) {
    const body = block.split(/\n### /)[0]
    const seed = /Seed \(hex\): ([0-9a-f]+)/.exec(body)[1]
    const chains = [...body.matchAll(/\* Chain (.+)\n {2}\* fingerprint: \w+\n {2}\* chain code: (\w+)\n {2}\* private: (\w+)\n {2}\* public: (\w+)/g)]
      .map(([, path, chainCode, priv, pub]) => ({ path: chain(path), chainCode, private: priv, public: pub.slice(2) }))
    out.push({ seed, chains })
  }
  return { source: `satoshilabs/slips@${rev(slips)} slip-0010.md`, vectors: out }
}

writeFileSync('vectors/bip32.json', JSON.stringify(bip32(), null, 2) + '\n')
writeFileSync('vectors/slip10-ed25519.json', JSON.stringify(slip10(), null, 2) + '\n')
