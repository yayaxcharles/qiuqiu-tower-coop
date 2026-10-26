import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LOBBY_RAW from '../../src/ui/screens/lobby.ts?raw';
import { CoopSession } from '../../src/net/session';
import { LoopbackPair } from '../../src/net/transport';
import { clearRejoin, keepRejoinAfterFail, readRejoin, shouldConfirmLeave, touchRejoin, writeRejoin, type LeaveCtx, type RejoinRecord } from '../../src/net/rejoin';
import { newCoopRun } from '../../src/engine/run';

/*
 * 稽核 2026-10-26 第 1、2、3 條：連線局離開前確認框與接回失敗提示。
 * 畫面層沒有瀏覽器跑不起來，判斷抽成純函式（`shouldConfirmLeave`、`keepRejoinAfterFail`）用假物件測，
 * 再用原始碼比對確認大廳真的接上了。
 */
const LOBBY = LOBBY_RAW.replace(/\r\n/g, '\n');

const base: LeaveCtx = {
  screen: 'map', sameSession: true, stopped: false, finished: false,
  hasCheckpoint: true, hasRun: true, runStatus: 'playing', phase: undefined,
};
const ask = (o: Partial<LeaveCtx>): boolean => shouldConfirmLeave({ ...base, ...o });

describe('離開前確認框：整局結束不再問（第 1 條）', () => {
  it('戰鬥與選牌問；地圖不問', () => {
    expect(ask({ screen: 'combat', phase: 'player' })).toBe(true);
    expect(ask({ screen: 'reward', phase: 'won' })).toBe(true);
    expect(ask({ screen: 'map' })).toBe(false);
  });

  it('通關：收場對白、結局幻燈片（畫面名還是 combat、phase 是 won）都不問', () => {
    expect(ask({ screen: 'combat', phase: 'won', finished: true })).toBe(false);
    expect(ask({ screen: 'combat', phase: 'won', finished: true, runStatus: 'won' })).toBe(false);
    expect(ask({ screen: 'result', finished: true, runStatus: 'won' })).toBe(false);
  });

  it('勝負剛判定、還沒進結算的空窗：只要會話標了打完、或整局狀態不是進行中，就不問', () => {
    expect(ask({ screen: 'combat', phase: 'player', finished: true })).toBe(false);
    expect(ask({ screen: 'combat', phase: 'player', runStatus: 'won' })).toBe(false);
    expect(ask({ screen: 'combat', phase: 'player', runStatus: 'lost' })).toBe(false);
  });

  it('全滅照舊不問；停掉的會話、別的會話不問', () => {
    expect(ask({ screen: 'combat', phase: 'lost' })).toBe(false);
    expect(ask({ screen: 'combat', stopped: true })).toBe(false);
    expect(ask({ screen: 'combat', sameSession: false })).toBe(false);
  });

  it('會話真的有 finished 屬性：runOver 之後才為真', () => {
    const link = new LoopbackPair();
    const s = new CoopSession(link.a, { isHost: true, seat: 0, onDesync: () => undefined });
    expect(s.finished).toBe(false);
    s.runOver();
    expect(s.finished).toBe(true);
  });
});

describe('離開前確認框：還沒有存檔點就問（第 2 條）', () => {
  it('序章、開局祝福、挑攻擊牌（畫面不是戰鬥／選牌、沒有存檔點）要問', () => {
    for (const screen of ['lobby', 'blessing', 'map', undefined]) {
      expect(ask({ screen, hasCheckpoint: false }), String(screen)).toBe(true);
    }
  });

  it('有存檔點的地圖、單人局（不是這個會話）、局還沒開出來（大廳等人）都不問', () => {
    expect(ask({ screen: 'blessing', hasCheckpoint: true })).toBe(false);
    expect(ask({ screen: 'blessing', hasCheckpoint: false, sameSession: false })).toBe(false);
    expect(ask({ screen: 'lobby', hasCheckpoint: false, hasRun: false })).toBe(false);
  });

  it('整局結束就算沒有存檔點也不問', () => {
    expect(ask({ screen: 'blessing', hasCheckpoint: false, finished: true })).toBe(false);
  });

  it('會話真的有 hasCheckpoint 屬性：第一次回到地圖才為真', () => {
    const link = new LoopbackPair();
    const s = new CoopSession(link.a, { isHost: true, seat: 0, onDesync: () => undefined });
    const run = newCoopRun('lg', 1, 'ninja', 'feifei');
    s.useRun(run);
    expect(s.hasCheckpoint).toBe(false);
    s.checkpoint(run);
    expect(s.hasCheckpoint).toBe(true);
    // 接回的會話手上本來就有存檔點
    const r = new CoopSession(link.b, { isHost: true, seat: 0, resume: { gen: 1, checkpoint: '{}' }, onDesync: () => undefined });
    expect(r.hasCheckpoint).toBe(true);
  });

  it('大廳的 beforeunload 接的是這個判斷', () => {
    const make = LOBBY.slice(LOBBY.indexOf('function makeSession('), LOBBY.indexOf('\n}\n', LOBBY.indexOf('function makeSession(')));
    const guard = make.slice(make.indexOf("window.addEventListener('beforeunload'"));
    expect(guard).toMatch(/shouldConfirmLeave\(\{/);
    expect(guard).toMatch(/finished: session\.finished/);
    expect(guard).toMatch(/hasCheckpoint: session\.hasCheckpoint/);
    expect(guard).toMatch(/e\.preventDefault\(\);/);
  });
});

describe('接回失敗、地獄包沒載到（第 3 條）', () => {
  let box: Map<string, string>;
  beforeEach(() => {
    box = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => box.get(k) ?? null,
      setItem: (k: string, v: string) => { box.set(k, v); },
      removeItem: (k: string) => { box.delete(k); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  const rec: RejoinRecord = { code: '123456', role: 'join', seat: 1, gen: 2, checkpoint: '{"d":6}', recv: 17, at: 0 };

  it('清掉之後寫回、有效期從現在起算，並掛 pagehide 去更新記錄時間', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    writeRejoin({ code: rec.code, role: rec.role, seat: rec.seat, gen: rec.gen, checkpoint: rec.checkpoint });
    clearRejoin();   // leaveCoop 做的事
    expect(readRejoin()).toBeNull();
    const listeners = new Map<string, () => void>();
    keepRejoinAfterFail(rec, { addEventListener: (k, fn) => { listeners.set(k, fn); } });
    expect(readRejoin(1_000_000)).toMatchObject({ code: '123456', checkpoint: '{"d":6}', gen: 2, recv: 17 });
    // 玩家看了很久才離開：離開那一刻重新起算，不會從失敗那一刻算兩分鐘
    vi.setSystemTime(1_000_000 + 100_000);
    listeners.get('pagehide')!();
    expect(listeners.get('pagehide')).toBe(touchRejoin);
    vi.setSystemTime(1_000_000 + 100_000 + 119_000);
    expect(readRejoin()).not.toBeNull();
  });

  it('大廳：記錄留著的那條路不跳「接不回」那句，只拿掉「正在接回」那條；沒留記錄才跳', () => {
    const rejoin = LOBBY.slice(LOBBY.indexOf('export function rejoinCoop('), LOBBY.indexOf('\nfunction startCoop('));
    const back = rejoin.slice(rejoin.indexOf('const back = '), rejoin.indexOf('// 存檔點是難度 6'));
    const keepAt = back.indexOf('if (keepRecord) {');
    const bannerAt = back.indexOf('troubleBanner(app, why)');
    expect(keepAt).toBeGreaterThan(0);
    expect(back).toMatch(/keepRejoinAfterFail\(rec, window\)/);
    expect(back.slice(keepAt, bannerAt)).toMatch(/return;/);
    expect(back.slice(keepAt, bannerAt)).not.toMatch(/troubleBanner/);
    expect(back.slice(keepAt, bannerAt)).toMatch(/data-who="rejoin"/);
    expect(bannerAt, '沒留記錄的失敗照舊跳').toBeGreaterThan(keepAt);
  });
});
