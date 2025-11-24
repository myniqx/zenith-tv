const vlcPlayer = require('./core/vlc-player');

console.log('[Node Test] ========================================');
console.log('[Node Test] VLC Player Node.js Test (No Electron)');
console.log('[Node Test] ========================================\n');

console.log('[Node Test] Creating VLC player instance...');
const player = vlcPlayer.createPlayer();

console.log('[Node Test] Setting up event listeners...');
player.on('stateChanged', (state) => {
    console.log('[Node Test] *** State changed:', state);
});

player.on('error', (message) => {
    console.error('[Node Test] *** ERROR:', message);
});

player.on('timeChanged', (time) => {
    if (time % 5000 < 100) {  // Log every ~5 seconds
        console.log('[Node Test] Time:', Math.floor(time / 1000), 'seconds');
    }
});

player.on('endReached', () => {
    console.log('[Node Test] *** End reached');
});

console.log('[Node Test] Creating child window (800x600)...');
player.createChildWindow(0n, 0, 0, 800, 600);

console.log('[Node Test] Setting volume to 100...');
player.setVolume(100);

console.log('[Node Test] Playing URL...');
const url = 'http://vizyon.pw:8080/movie/merveokur/N328M8VJ/10102.mkv';
const result = player.play(url);
console.log('[Node Test] Play result:', result);

console.log('[Node Test] Waiting 15 seconds...\n');

// Check state after 2 seconds
setTimeout(() => {
    const state = player.getState();
    const isPlaying = player.isPlaying();
    console.log('[Node Test] ========================================');
    console.log('[Node Test] Status Check (after 2s):');
    console.log('[Node Test]   State:', state);
    console.log('[Node Test]   Is Playing:', isPlaying);
    console.log('[Node Test] ========================================\n');
}, 2000);

setTimeout(() => {
    console.log('\n[Node Test] ========================================');
    console.log('[Node Test] Test completed - cleaning up...');
    player.stop();
    player.dispose();
    console.log('[Node Test] Done!');
    console.log('[Node Test] ========================================');
    process.exit(0);
}, 15000);
