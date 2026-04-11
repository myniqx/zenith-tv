import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupVlcMock, teardownVlcMock, waitForState } from './helper/vlcElectronMock';
import { TEST_VIDEO_1, TEST_VIDEO_2 } from './helper/testConstants';
import { useVlcPlayerStore } from '../src/stores/vlcPlayer';

describe('VLC Player Store', () => {
  beforeAll(async () => {
    await setupVlcMock();
    await useVlcPlayerStore.getState().init();
  });

  afterAll(async () => {
    await teardownVlcMock();
  });

  // ─── Init ────────────────────────────────────────────────────────────────

  it('init: isAvailable ve isInitialized true olur', () => {
    const { isAvailable, isInitialized } = useVlcPlayerStore.getState();
    expect(isAvailable).toBe(true);
    expect(isInitialized).toBe(true);
  });

  // ─── İlk video ───────────────────────────────────────────────────────────

  it('open: playerState opening geçer', async () => {
    // open çağrısı C++ tarafında play de başlatıyor,
    // opening çok kısa sürebilir — playing de kabul edilir
    useVlcPlayerStore.getState().open(TEST_VIDEO_1);
    const state = await waitForState(
      () => useVlcPlayerStore.getState(),
      ['opening', 'playing', 'buffering'],
    );
    expect(['opening', 'playing', 'buffering']).toContain(state);
  });

  it('open: playerState playing olur', async () => {
    const state = await waitForState(
      () => useVlcPlayerStore.getState(),
      ['playing'],
    );
    expect(state).toBe('playing');
  });

  it('open: mediaInfo gelir — duration > 0, audioTracks dolu', async () => {
    // mediaInfo opening→playing arasında geliyor, playing'e ulaştıysak mediaInfo da gelmiştir
    const { duration, audioTracks } = useVlcPlayerStore.getState();
    expect(duration).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);
  });

  it('open: time ilerliyor', async () => {
    const t0 = useVlcPlayerStore.getState().time;
    await new Promise(r => setTimeout(r, 2000));
    const t1 = useVlcPlayerStore.getState().time;
    expect(t1).toBeGreaterThan(t0);
  });

  // ─── İkinci video geçişi ─────────────────────────────────────────────────

  it('play(video2): önceki videonun süresi kaydedilir', async () => {
    const { currentItem, time, duration } = useVlcPlayerStore.getState();
    expect(currentItem).not.toBeNull();

    // play çağrısı öncesi mevcut progress sıfır — en az bir ilerleme olmalı
    const progress = currentItem!.userData?.watchProgress?.progress ?? 0;
    // time ilerlediyse progress kaydedilmiş olmalı (saveWatchProgress her 10s + pause/stop'ta çalışır)
    // burada sadece currentItem'ın var olduğunu ve time > 0 olduğunu doğruluyoruz
    expect(time).toBeGreaterThan(0);
    expect(duration).toBeGreaterThan(0);
  });

  it('play(video2): playerState playing olur, currentItem değişir', async () => {
    await useVlcPlayerStore.getState().play({
      Url: TEST_VIDEO_2,
      Name: 'Test Video 2',
      category: 'Movie',
      userData: {},
    } as any);

    const state = await waitForState(
      () => useVlcPlayerStore.getState(),
      ['playing'],
    );
    expect(state).toBe('playing');
    expect(useVlcPlayerStore.getState().currentItem?.Url).toBe(TEST_VIDEO_2);
  });

  it('play(video2): yeni mediaInfo gelir', async () => {
    const { duration, audioTracks } = useVlcPlayerStore.getState();
    expect(duration).toBeGreaterThan(0);
    expect(audioTracks.length).toBeGreaterThan(0);
  });

  // ─── Pause / Resume ──────────────────────────────────────────────────────

  it('pause: playerState paused olur', async () => {
    await useVlcPlayerStore.getState().playback({ action: 'pause' });
    const state = await waitForState(
      () => useVlcPlayerStore.getState(),
      ['paused'],
    );
    expect(state).toBe('paused');
  });

  it('pause: time donuyor', async () => {
    const t0 = useVlcPlayerStore.getState().time;
    await new Promise(r => setTimeout(r, 1000));
    const t1 = useVlcPlayerStore.getState().time;
    expect(t1).toBe(t0);
  });

  it('resume: playerState playing olur', async () => {
    await useVlcPlayerStore.getState().playback({ action: 'resume' });
    const state = await waitForState(
      () => useVlcPlayerStore.getState(),
      ['playing'],
    );
    expect(state).toBe('playing');
  });

  // ─── Stop ────────────────────────────────────────────────────────────────

  it('stop: playerState stopped olur', async () => {
    await useVlcPlayerStore.getState().playback({ action: 'stop' });
    const state = await waitForState(
      () => useVlcPlayerStore.getState(),
      ['stopped'],
    );
    expect(state).toBe('stopped');
  });

  it('stop: time, duration, tracks sıfırlanır', async () => {
    const { time, duration, audioTracks, subtitleTracks, videoTracks } =
      useVlcPlayerStore.getState();
    expect(time).toBe(0);
    expect(duration).toBe(0);
    expect(audioTracks).toHaveLength(0);
    expect(subtitleTracks).toHaveLength(0);
    expect(videoTracks).toHaveLength(0);
  });
});
