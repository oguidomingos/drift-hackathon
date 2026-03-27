/**
 * Patches helius-laserstream's grpc.js in @drift-labs/sdk to gracefully
 * handle missing Windows native binaries (win32-x64-msvc not published to npm).
 * We use BulkAccountLoader (HTTP polling) — not gRPC — so this is safe.
 * Run via: node scripts/patch-grpc.js
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('fs');

const SEARCH_GLOB = path.join(
  __dirname,
  '..',
  'node_modules',
  '.pnpm',
  '@drift-labs+sdk@*',
  'node_modules',
  '@drift-labs',
  'sdk',
  'lib',
  'node',
  'isomorphic',
  'grpc.js'
);

const BAD = `const helius_laserstream_1 = require("helius-laserstream");`;
const GOOD = `let helius_laserstream_1 = {};
try {
  helius_laserstream_1 = require("helius-laserstream");
} catch(e) {
  // Native binary not available on this platform — using BulkAccountLoader instead
}`;

// Manual glob using fs
const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
const entries = fs.readdirSync(pnpmDir).filter(e => e.startsWith('@drift-labs+sdk@'));

let patched = 0;
for (const entry of entries) {
  const grpcPath = path.join(
    pnpmDir, entry, 'node_modules', '@drift-labs', 'sdk',
    'lib', 'node', 'isomorphic', 'grpc.js'
  );
  if (!fs.existsSync(grpcPath)) continue;
  const content = fs.readFileSync(grpcPath, 'utf8');
  if (content.includes('Native binary not available')) {
    console.log(`Already patched: ${entry}`);
    continue;
  }
  if (!content.includes(BAD)) {
    console.log(`Not found (may be different version): ${entry}`);
    continue;
  }
  fs.writeFileSync(grpcPath, content.replace(BAD, GOOD));
  console.log(`Patched: ${entry}`);
  patched++;
}

console.log(`\nDone. Patched ${patched} files.`);
