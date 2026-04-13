#!/usr/bin/env node
// Builds libzenith_parser.so for Android targets and copies to Flutter jniLibs.
// Usage: node scripts/build-android.js
//   --targets  comma-separated list: arm64-v8a,armeabi-v7a,x86_64  (default: arm64-v8a)
//   --release  build in release mode (default: true)

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PARSER_DIR = path.resolve(__dirname, '..');
const JNILIBS_DIR = path.resolve(
  __dirname,
  '../../../apps/mobile/android/app/src/main/jniLibs'
);

const TARGET_MAP = {
  'arm64-v8a':   'aarch64-linux-android',
  'armeabi-v7a': 'armv7-linux-androideabi',
  'x86_64':      'x86_64-linux-android',
};

// Parse --targets arg
const targetsArg = process.argv.find(a => a.startsWith('--targets='));
const requestedTargets = targetsArg
  ? targetsArg.replace('--targets=', '').split(',')
  : ['arm64-v8a'];

const invalid = requestedTargets.filter(t => !TARGET_MAP[t]);
if (invalid.length) {
  console.error(`Unknown targets: ${invalid.join(', ')}`);
  console.error(`Valid targets: ${Object.keys(TARGET_MAP).join(', ')}`);
  process.exit(1);
}

let anyFailed = false;

for (const abiTarget of requestedTargets) {
  const rustTarget = TARGET_MAP[abiTarget];
  const outDir = path.join(PARSER_DIR, 'target', rustTarget, 'release');
  const soSrc  = path.join(outDir, 'libzenith_parser.so');
  const jniDir = path.join(JNILIBS_DIR, abiTarget);
  const soDst  = path.join(jniDir, 'libzenith_parser.so');

  console.log(`\n[build-android] Building ${abiTarget} (${rustTarget})...`);

  try {
    execSync(`cargo ndk -t ${abiTarget} build --release`, {
      cwd: PARSER_DIR,
      stdio: 'inherit',
    });
  } catch {
    console.error(`[build-android] cargo-ndk failed for ${abiTarget}`);
    anyFailed = true;
    continue;
  }

  if (!fs.existsSync(soSrc)) {
    console.error(`[build-android] .so not found at ${soSrc}`);
    anyFailed = true;
    continue;
  }

  fs.mkdirSync(jniDir, { recursive: true });
  fs.copyFileSync(soSrc, soDst);
  const sizeKB = (fs.statSync(soDst).size / 1024).toFixed(1);
  console.log(`[build-android] Copied → ${soDst} (${sizeKB} KB)`);
}

if (anyFailed) {
  console.error('\n[build-android] One or more targets failed.');
  process.exit(1);
} else {
  console.log('\n[build-android] Done.');
}
