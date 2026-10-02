// Guard: mda never logs its config, a connection string or the request options again. It printed config
// ({ mongoClusters: { api, src, vin }, readOnly, readWrite }) on every request, about 4,900 log lines a day
// with the clusters' user:password (2026-10-02). Run with `npm run guard` (node:test, no dependencies).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scrubUri } from '../scrub.js'

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const consoleCalls = (text) => [...text.matchAll(/console\.(?:log|warn|error|info|debug)\(([\s\S]*?)\)\s*$/gm)].map((m) => m[1])

test('no console call logs config, options, connection strings or the environment', () => {
  for (const file of ['index.js', 'serve.js']) {
    for (const args of consoleCalls(source(file))) {
      assert.ok(!/(^|[\s,(])(config|options|connectionStrings|clusters|opt)\s*([,)]|$)/.test(args), `${file}: ${args.trim()}`)
      assert.ok(!/process\.env(?!\.PORT)|config\.(mongoClusters|readOnly|readWrite)\b(?!\))/.test(args), `${file}: ${args.trim()}`)
    }
  }
})

test('the only cluster facts logged are their names', () => {
  assert.match(source('index.js'), /Using clusters: \$\{Object\.keys\(config\.mongoClusters\)\.join\(', '\)\}/)
})

test('scrubUri removes a connection string’s user and password', () => {
  assert.equal(
    scrubUri('connect to mongodb+srv://appuser:s3cret@api.example.mongodb.net/db failed'),
    'connect to mongodb+srv://…@api.example.mongodb.net/db failed',
  )
  assert.equal(scrubUri('no uri here'), 'no uri here')
  assert.equal(scrubUri(undefined), '')
})
