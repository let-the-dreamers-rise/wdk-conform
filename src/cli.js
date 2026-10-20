#!/usr/bin/env node
// Runs every check and writes report/report.json plus report/REPORT.md.
//
//   node src/cli.js                     exit 1 if any check fails
//   node src/cli.js --baseline known.json
//                                       exit 1 only if a check fails that is not listed in the
//                                       baseline, or a listed one now passes (so the list is
//                                       kept honest when upstream ships a fix)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { ALL } from './conform.js'
import { chains, versionOf } from './chains.js'

const results = []
for (const [name, check] of Object.entries(ALL)) {
  process.stderr.write(`running ${name}...\n`)
  results.push(...await check())
}

const versions = Object.fromEntries(chains.map((c) => [c.pkg, versionOf(c.pkg)]))
const failed = results.filter((r) => r.failures.length)
const total = results.reduce((s, r) => s + r.cases, 0)

const row = (r) => `| ${r.id} | ${r.chain} | ${r.config ? '`' + JSON.stringify(r.config) + '`' : ''} | ${r.cases} | ${r.failures.length ? `**${r.failures.length} fail**` : 'pass'} |`
const md = [
  '# wdk-conform report',
  '',
  `${total} cases, ${failed.length} of ${results.length} checks failing.`,
  '',
  '## Modules tested',
  '',
  ...Object.entries(versions).map(([p, v]) => `- \`${p}@${v}\``),
  '',
  '## Results',
  '',
  '| check | chain | config | cases | result |',
  '|---|---|---|---|---|',
  ...results.map(row),
  '',
  '## First failure of each failing check',
  '',
  ...failed.flatMap((r) => [`### ${r.id} / ${r.chain}${r.config ? ' ' + JSON.stringify(r.config) : ''}`, '', '```json', JSON.stringify(r.failures[0], null, 2), '```', ''])
].join('\n')

mkdirSync('report', { recursive: true })
writeFileSync('report/report.json', JSON.stringify({ versions, results }, null, 2) + '\n')
writeFileSync('report/REPORT.md', md + '\n')
console.log(md)

const key = (r) => [r.id, r.chain, r.config ? JSON.stringify(r.config) : ''].join(' ').trim()
const b = process.argv.indexOf('--baseline')
if (b === -1) process.exit(failed.length ? 1 : 0)

const file = process.argv[b + 1]
const known = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).failing : []
const now = failed.map(key)
const unexpected = now.filter((k) => !known.includes(k))
const fixed = known.filter((k) => !now.includes(k))
for (const k of unexpected) console.error(`NEW FAILURE: ${k}`)
for (const k of fixed) console.error(`NOW PASSING (remove from baseline): ${k}`)
process.exit(unexpected.length || fixed.length ? 1 : 0)
