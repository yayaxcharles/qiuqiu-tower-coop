import { describe, expect, it } from 'vitest';
import { cardById } from '../../src/content/cards';
import { seenNeedsNote } from '../../src/engine/hell';
import APP_RAW from '../../src/ui/app.ts?raw';
import LOBBY_RAW from '../../src/ui/screens/lobby.ts?raw';
import TITLE_RAW from '../../src/ui/screens/title.ts?raw';
import COMBAT_RAW from '../../src/ui/screens/combat.ts?raw';

/*
 * 2026-10-25 Codex 審查（地獄）抓到的幾條。流程類的（接回、連按、會話停止、過期回呼、局部更新）要真的跑得架起整個 App 與連線，
 * 這裡照倉庫慣例守原始碼約定；滅世倒數另在 tests/engine/hell-source-doom.test.ts 用真引擎測。
 */
const norm = (s: string): string => s.replace(/\r\n/g, '\n');
const APP = norm(APP_RAW); const LOBBY = norm(LOBBY_RAW); const TITLE = norm(TITLE_RAW); const COMBAT = norm(COMBAT_RAW);

describe('地獄審查 2026-10-25', () => {
  it('中-2 接回時地獄包載不到：leaveCoop 也要留著接回紀錄', () => {
    const i = LOBBY.indexOf('const back = (why: string, keepRecord = false): void => {');
    const leave = LOBBY.indexOf('app.leaveCoop();', i);
    const restore = LOBBY.indexOf('if (keepRecord) keepRejoinAfterFail(rec);', i);   // 寫回的內容見 tests/net/leave_guard_1026.test.ts
    expect(i).toBeGreaterThan(0);
    expect(restore).toBeGreaterThan(leave);   // 清完再寫回去，順序反了就白寫
    expect(APP).toContain('clearRejoin();   // 自己離開連線局');
  });

  it('中-3 等地獄包的期間連按出發：只跑最後一筆', () => {
    expect(APP).toContain('const last = this.hellWaiters.splice(0).filter((w) => w.seq === this.navSeq).pop();');
    expect(APP).not.toMatch(/for \(const w of this\.hellWaiters\.splice\(0\)\)/);
  });

  it('中-4 地獄小標籤變了：局部更新退回整頁重畫', () => {
    expect(COMBAT).toContain('if (before.hellTags !== hellTagsKey(cs)) return false;');
    expect(COMBAT).toContain('hellTags: hellTagsKey(cs)');
  });

  it('小-5 房主等地獄包時房客走了：不開局', () => {
    expect(LOBBY).toContain("app.whenHellReady(diff, () => { if (session.stopped) return; session.start(seed, diff, '', heroes); begin(seed, diff, heroes); }, giveUp);");
  });

  it('小-6 一針斃命被看穿：牌面不補「總傷害減半」（斬殺不吃看穿）', () => {
    const c = cardById['feifei_yizhen']!;
    expect(seenNeedsNote(c, false)).toBe(false);
    expect(seenNeedsNote(c, true)).toBe(false);
  });

  it('補充 局面碼等下載時已經離開標題：結果作廢、不存不開', () => {
    const i = TITLE.indexOf('void decodeRun(seed.value).then((res) => {');
    const guard = TITLE.indexOf("if (!startBtn.closest('#screen')) return;", i);
    const save = TITLE.indexOf('saveRun(res.run);', i);
    expect(i).toBeGreaterThan(0);
    expect(guard).toBeGreaterThan(i);
    expect(guard).toBeLessThan(save);
  });
});
