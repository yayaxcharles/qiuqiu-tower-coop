import { describe, expect, it, vi } from 'vitest';
import { newCoopRun, newRun } from '../../src/engine/run';
import { rollBlessings, blessChoices } from '../../src/engine/blessing';
import { encodeRun } from '../../src/engine/sharecode';
import { runFingerprint } from '../../src/net/hash';
import type { RunState } from '../../src/engine/types';

/*
 * 拆包審查修正（2026-10-24）：全域 setup 會先把地獄包載好，這裡每一條都 `vi.resetModules()` 之後在「地獄包未載」的狀態下跑，
 * 才碰得到 `whenHellReady`、`checkRun` 略過遭遇檢查、客戶端比 `useRun` 早收到整局動作這幾條路。
 */
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

describe('地獄包未載時', () => {
  it('壞的地獄局面碼（遭遇 id 不存在）：decodeRun 回錯誤、接收者原本的存檔不動', async () => {
    // 碼用已載好的那一份模組產生，再把第一個有遭遇的格子改成不存在的 id
    const hellRun = newRun('hell-bad-code', 6);
    const node = hellRun.map.nodes.find((n) => n.encounterId)!;
    node.encounterId = 'hell_no_such_encounter';
    const code = (await encodeRun(hellRun))!;
    expect(code).toBeTruthy();

    vi.resetModules();
    const enemies = await import('../../src/content/enemies');
    expect(enemies.isHellLoaded(), '前提：地獄包未載').toBe(false);
    const save = await import('../../src/engine/save');
    const share = await import('../../src/engine/sharecode');
    save.setStore(memStore());
    const mine = newRun('my-own-save', 1);
    save.saveRun(mine);

    const res = await share.decodeRun(code);
    expect(res.ok).toBe(false);
    expect(res.ok ? '' : res.why, '失敗原因是版本對不上（遭遇不存在），不是別的').toContain('版本跟你現在的遊戲對不上');
    expect(enemies.isHellLoaded(), 'decodeRun 先把地獄包載好才驗').toBe(true);
    expect(save.loadRun()?.seed, '存檔沒被動').toBe('my-own-save');
  });

  it('客戶端在 useRun 之前收到整局動作：排隊，useRun 之後照序套用、不判不同步', async () => {
    vi.resetModules();
    const { CoopSession } = await import('../../src/net/session');
    const { LoopbackPair } = await import('../../src/net/transport');
    const mk = (): RunState => { const r = newCoopRun('pre-run', 1, 'dangdang', 'fengfeng'); rollBlessings(r); r.players[0]!.bless = { offer: ['bless_moves'] }; r.players[1]!.bless = { offer: ['bless_doodle'] }; return r; };
    const a = mk(); const b = mk();
    const pair = new LoopbackPair();
    const bad: string[] = [];
    const host = new CoopSession(pair.a, { isHost: true, seat: 0, onDesync: (w) => bad.push(w) });
    const guest = new CoopSession(pair.b, { isHost: false, seat: 1, onDesync: (w) => bad.push(w) });
    host.useRun(a);   // 主機先開局先選祝福，客戶端還在抓地獄包（沒 useRun）
    const c = blessChoices(a, 0, 'bless_moves')[0]!.id;
    expect(host.submitRun({ t: 'bless', seat: 0, i: 0, c })).toBe(true);
    expect(bad, '沒開局就收到：不能判不同步').toEqual([]);
    expect(guest.stopped).toBe(false);
    expect(runFingerprint(a)).not.toBe(runFingerprint(b));   // 還沒套
    guest.useRun(b);
    expect(bad).toEqual([]);
    expect(guest.stopped).toBe(false);
    expect(runFingerprint(a), '補套之後兩邊一樣').toBe(runFingerprint(b));
  });

  it('whenHellReady：載入期間玩家換了畫面（導航序號變了）就不叫 go／fail；沒換的照叫，載入中再來的也排進去', async () => {
    vi.resetModules();
    vi.doMock('../../src/ui/dialogue', async (orig) => ({ ...(await orig<object>()), notice: () => undefined }));
    const { App } = await import('../../src/ui/app');
    const enemies = await import('../../src/content/enemies');
    expect(enemies.isHellLoaded()).toBe(false);
    const fake = { hellPending: App.prototype.hellPending, navSeq: 0, hellLoading: false, hellWaiters: [] as unknown[], hellBar: () => null };
    const whenReady = App.prototype.whenHellReady as (this: typeof fake, d: number, go: () => void, fail: () => void) => void;
    const calls: string[] = [];
    whenReady.call(fake, 6, () => calls.push('go-moved'), () => calls.push('fail-moved'));
    fake.navSeq++;   // 第一筆掛了之後玩家換了畫面
    whenReady.call(fake, 6, () => calls.push('go-stay'), () => calls.push('fail-stay'));   // 載入中再來：掛進清單，不丟
    expect(fake.hellWaiters).toHaveLength(2);
    await enemies.ensureHell();
    await Promise.resolve(); await Promise.resolve();
    expect(calls, '只有沒換畫面的那一筆會叫').toEqual(['go-stay']);
    calls.length = 0;
    expect(fake.hellLoading).toBe(false);

    // 已載好：同步叫 go；難度 1 本來就同步
    whenReady.call(fake, 6, () => calls.push('go-loaded'), () => calls.push('fail'));
    whenReady.call(fake, 1, () => calls.push('go-d1'), () => calls.push('fail'));
    expect(calls).toEqual(['go-loaded', 'go-d1']);
    vi.doUnmock('../../src/ui/dialogue');
  });

  it('whenHellReady：地獄包卡著不回（沒斷網）20 秒就走失敗那條、清掉載入中旗標（審查 2026-10-30 第 5 條）', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.doMock('../../src/ui/dialogue', async (orig) => ({ ...(await orig<object>()), notice: () => undefined }));
    vi.doMock('../../src/content/enemies', async (orig) => ({ ...(await orig<object>()), ensureHell: () => new Promise<void>(() => undefined) }));
    try {
      const { App } = await import('../../src/ui/app');
      const bars: boolean[] = [];
      const fake = { hellPending: () => true, navSeq: 0, hellLoading: false, hellWaiters: [] as unknown[], hellBar: (_t: string, reload = false) => { bars.push(reload); return null; } };
      const whenReady = App.prototype.whenHellReady as (this: typeof fake, d: number, go: () => void, fail: () => void) => void;
      const calls: string[] = [];
      whenReady.call(fake, 6, () => calls.push('go'), () => calls.push('fail'));
      await vi.advanceTimersByTimeAsync(19000);
      expect(calls).toEqual([]);
      expect(fake.hellLoading).toBe(true);
      await vi.advanceTimersByTimeAsync(2000);
      expect(calls).toEqual(['fail']);
      expect(fake.hellLoading, '下一次再按會重新開始，不是只排進清單').toBe(false);
      expect(bars, '載入中一條、失敗（附重新整理）一條').toEqual([false, true]);
    } finally {
      vi.useRealTimers();
      vi.doUnmock('../../src/content/enemies');
      vi.doUnmock('../../src/ui/dialogue');
    }
  });

  it('checkRun 在地獄包未載時照收遭遇 id 不存在的地獄局（所以連線接回要在 resyncTo 先載好再驗，審查 2026-10-30 第 1 條）', async () => {
    const hellRun = newCoopRun('hell-bad-resync', 6, 'ninja', 'ninja');
    hellRun.map.nodes.find((n) => n.encounterId)!.encounterId = 'hell_no_such_encounter';
    const json = JSON.stringify(hellRun);
    vi.resetModules();
    const enemies = await import('../../src/content/enemies');
    const save = await import('../../src/engine/save');
    expect(enemies.isHellLoaded()).toBe(false);
    const run = save.checkRun(JSON.parse(json) as Partial<RunState>);
    expect(run, '沒載地獄包時略過遭遇檢查').not.toBeNull();
    await enemies.ensureHell();
    expect(save.encountersKnown(run!), '載好之後補驗才抓得到').toBe(false);
    expect(save.checkRun(JSON.parse(json) as Partial<RunState>), '載好之後再跑一次 checkRun 也抓得到').toBeNull();
  });
});
