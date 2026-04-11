import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  setupVlcMock, teardownVlcMock,
  waitForState, waitForScreenMode, waitForWindowResize,
  triggerWindowMove, resetLastWindowResize, makeFakeElement,
} from './helper/vlcElectronMock';
import { TEST_VIDEO_1, TEST_VIDEO_2 } from './helper/testConstants';
import { useVlcPlayerStore } from '../src/stores/vlcPlayer';
import { DEFAULT_SCREEN_MODE } from '../src/stores/vlcPlayer';

describe('VLC Screen Mode', () => {
  beforeAll(async () => {
    await setupVlcMock();
    await useVlcPlayerStore.getState().init();
    await useVlcPlayerStore.getState().open(TEST_VIDEO_1);
    await waitForState(() => useVlcPlayerStore.getState(), ['playing']);
  });

  afterAll(async () => {
    await teardownVlcMock();
  });

  // ─── Default mode ─────────────────────────────────────────────────────────

  it('default screenMode is DEFAULT_SCREEN_MODE after first open', () => {
    expect(useVlcPlayerStore.getState().screenMode).toBe(DEFAULT_SCREEN_MODE);
  });

  // ─── Sticky without element — graceful fallback ────────────────────────────

  it('setScreenMode(sticky) without stickyElement falls back to DEFAULT_SCREEN_MODE', async () => {
    expect(useVlcPlayerStore.getState().stickyElement).toBeNull();
    useVlcPlayerStore.getState().setScreenMode('sticky');
    const mode = await waitForScreenMode(
      () => useVlcPlayerStore.getState(),
      DEFAULT_SCREEN_MODE,
    );
    expect(mode).toBe(DEFAULT_SCREEN_MODE);
  });

  // ─── Sticky with element ──────────────────────────────────────────────────

  it('setScreenMode(sticky) with stickyElement transitions to sticky', async () => {
    const el = makeFakeElement({ x: 100, y: 200, width: 640, height: 360 });
    useVlcPlayerStore.getState().setStickyElement(el);
    useVlcPlayerStore.getState().setScreenMode('sticky');
    const mode = await waitForScreenMode(
      () => useVlcPlayerStore.getState(),
      'sticky',
    );
    expect(mode).toBe('sticky');
  });

  // ─── Sticky: window move triggers VLC resize ─────────────────────────────

  it('sticky: moving main window sends resize to VLC', async () => {
    resetLastWindowResize();

    // Simulate Electron main window moving to (50, 80)
    // stickyElement is at x:100, y:200 relative to client
    // expected VLC bounds: x=50+100=150, y=80+200=280, w=640, h=360
    triggerWindowMove({ x: 50, y: 80, scaleFactor: 1, minimized: false });

    const resize = await waitForWindowResize();
    expect(resize.x).toBe(150);
    expect(resize.y).toBe(280);
    expect(resize.width).toBe(640);
    expect(resize.height).toBe(360);
  });

  // ─── Sticky: minimize / restore ──────────────────────────────────────────

  it('sticky: minimize while playing → pauses', async () => {
    await waitForState(() => useVlcPlayerStore.getState(), ['playing']);
    triggerWindowMove({ x: 50, y: 80, scaleFactor: 1, minimized: true });
    const state = await waitForState(() => useVlcPlayerStore.getState(), ['paused']);
    expect(state).toBe('paused');
  });

  it('sticky: restore after minimize → resumes playing', async () => {
    triggerWindowMove({ x: 50, y: 80, scaleFactor: 1, minimized: false });
    const state = await waitForState(() => useVlcPlayerStore.getState(), ['playing']);
    expect(state).toBe('playing');
  });

  it('sticky: minimize while paused → stays paused, restore does not resume', async () => {
    await useVlcPlayerStore.getState().playback({ action: 'pause' });
    await waitForState(() => useVlcPlayerStore.getState(), ['paused']);

    triggerWindowMove({ x: 50, y: 80, scaleFactor: 1, minimized: true });
    await new Promise(r => setTimeout(r, 500));
    expect(useVlcPlayerStore.getState().playerState).toBe('paused');

    triggerWindowMove({ x: 50, y: 80, scaleFactor: 1, minimized: false });
    await new Promise(r => setTimeout(r, 500));
    // was not playing before minimize, should stay paused
    expect(useVlcPlayerStore.getState().playerState).toBe('paused');

    // resume for next tests
    await useVlcPlayerStore.getState().playback({ action: 'resume' });
    await waitForState(() => useVlcPlayerStore.getState(), ['playing']);
  });

  // ─── Sticky: mode persists across video change ────────────────────────────

  it('sticky: stop then open new video, mode stays sticky', async () => {
    await useVlcPlayerStore.getState().playback({ action: 'stop' });
    await waitForState(() => useVlcPlayerStore.getState(), ['stopped']);
    await useVlcPlayerStore.getState().open(TEST_VIDEO_2);
    await waitForState(() => useVlcPlayerStore.getState(), ['playing']);
    const mode = await waitForScreenMode(() => useVlcPlayerStore.getState(), 'sticky');
    expect(mode).toBe('sticky');
  });

  // ─── Free_ontop mode ──────────────────────────────────────────────────────

  it('setScreenMode(free_ontop) → VLC confirms free_ontop', async () => {
    useVlcPlayerStore.getState().setScreenMode('free_ontop');
    const mode = await waitForScreenMode(() => useVlcPlayerStore.getState(), 'free_ontop');
    expect(mode).toBe('free_ontop');
  });

  it('free_ontop: stop then open new video, mode stays free_ontop', async () => {
    await useVlcPlayerStore.getState().playback({ action: 'stop' });
    await waitForState(() => useVlcPlayerStore.getState(), ['stopped']);
    await useVlcPlayerStore.getState().open(TEST_VIDEO_1);
    await waitForState(() => useVlcPlayerStore.getState(), ['playing']);
    const mode = await waitForScreenMode(() => useVlcPlayerStore.getState(), 'free_ontop');
    expect(mode).toBe('free_ontop');
  });

  // ─── Fullscreen mode ──────────────────────────────────────────────────────

  it('setScreenMode(fullscreen) → VLC confirms fullscreen', async () => {
    useVlcPlayerStore.getState().setScreenMode('fullscreen');
    const mode = await waitForScreenMode(() => useVlcPlayerStore.getState(), 'fullscreen');
    expect(mode).toBe('fullscreen');
  });

  it('fullscreen: stop then open new video, mode falls back to DEFAULT_SCREEN_MODE', async () => {
    await useVlcPlayerStore.getState().playback({ action: 'stop' });
    await waitForState(() => useVlcPlayerStore.getState(), ['stopped']);
    await useVlcPlayerStore.getState().open(TEST_VIDEO_2);
    await waitForState(() => useVlcPlayerStore.getState(), ['playing']);
    const mode = await waitForScreenMode(
      () => useVlcPlayerStore.getState(),
      DEFAULT_SCREEN_MODE,
    );
    expect(mode).toBe(DEFAULT_SCREEN_MODE);
  });
});
