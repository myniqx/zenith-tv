/**
 * Simple VLC test to diagnose initialization issues
 * Run with: node test-vlc.js
 */

const path = require('path');

console.log('='.repeat(60));
console.log('VLC Native Module Test (Node.js standalone)');
console.log('='.repeat(60));

// Check platform
console.log('[Test] Platform:', process.platform);
console.log('[Test] Architecture:', process.arch);
console.log('[Test] Node version:', process.version);
console.log('');

// Set VLC paths before requiring the module
let vlcLibPath, pluginsPath;

if (process.platform === 'win32') {
  // Try system VLC first
  const systemVlcPath = 'C:\\Program Files\\VideoLAN\\VLC';
  const fs = require('fs');

  if (fs.existsSync(path.join(systemVlcPath, 'libvlc.dll'))) {
    console.log('[Test] System VLC found!');
    vlcLibPath = systemVlcPath;
    pluginsPath = path.join(systemVlcPath, 'plugins');
  } else {
    console.log('[Test] System VLC not found, using bundled SDK');
    vlcLibPath = path.join(__dirname, 'lib', 'win32');
    pluginsPath = path.join(vlcLibPath, 'plugins');
  }
} else if (process.platform === 'linux') {
  vlcLibPath = '/usr/lib/x86_64-linux-gnu';
  pluginsPath = '/usr/lib/x86_64-linux-gnu/vlc/plugins';
} else {
  vlcLibPath = path.join(__dirname, 'lib', process.platform);
  pluginsPath = path.join(vlcLibPath, 'plugins');
}

console.log('[Test] VLC lib path:', vlcLibPath);
console.log('[Test] Plugins path:', pluginsPath);
console.log('');

// Add to PATH (Windows only)
if (process.platform === 'win32') {
  process.env.PATH = `${vlcLibPath};${process.env.PATH}`;
  console.log('[Test] Added VLC to PATH');
}

process.env.VLC_PLUGIN_PATH = pluginsPath;
console.log('[Test] Set VLC_PLUGIN_PATH');
console.log('');

console.log('[Test] Loading VLC module...');

try {
  const vlc = require('./index.js');
  console.log('[Test] ✓ Module loaded successfully');
  console.log('');

  console.log('[Test] Checking VLC availability...');
  const isAvail = vlc.isAvailable();
  console.log('[Test] VLC available:', isAvail ? '✓ YES' : '✗ NO');
  console.log('');

  if (isAvail) {
    console.log('[Test] Creating VLC player instance...');
    try {
      const player = vlc.createPlayer();
      console.log('[Test] ✓ Player created successfully!');
      console.log('[Test] Player type:', typeof player);
      console.log('[Test] Player constructor:', player.constructor.name);

      // Try to check if player has expected methods
      const methods = ['open', 'playback', 'audio', 'video', 'dispose'];
      console.log('[Test] Checking player methods:');
      methods.forEach(method => {
        const hasMethod = typeof player[method] === 'function';
        console.log(`[Test]   ${method}: ${hasMethod ? '✓' : '✗'}`);
      });

      console.log('');
      console.log('='.repeat(60));
      console.log('SUCCESS: VLC player is working!');
      console.log('='.repeat(60));

      // Cleanup
      if (typeof player.dispose === 'function') {
        player.dispose();
        console.log('[Test] Player disposed');
      }

      process.exit(0);
    } catch (err) {
      console.error('[Test] ✗ Failed to create player');
      console.error('[Test] Error:', err.message);
      console.error('[Test] Stack:', err.stack);
      process.exit(1);
    }
  } else {
    console.log('[Test] VLC not available - attempting to create player anyway for diagnostics...');

    try {
      const player = vlc.createPlayer();
      console.log('[Test] Unexpected: Player created despite availability check failing');
    } catch (err) {
      console.error('[Test] Error details:', err.message);
      if (err.stack) {
        console.error('[Test] Stack trace:');
        console.error(err.stack);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('FAILED: VLC is not available');
    console.log('='.repeat(60));
    process.exit(1);
  }
} catch (err) {
  console.error('[Test] ✗ Fatal error loading module');
  console.error('[Test] Error:', err.message);
  console.error('[Test] Stack:', err.stack);
  console.log('');
  console.log('='.repeat(60));
  console.log('FAILED: Could not load VLC module');
  console.log('='.repeat(60));
  process.exit(1);
}
