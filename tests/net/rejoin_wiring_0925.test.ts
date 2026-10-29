import { describe, expect, it } from 'vitest';
import COMBAT_RAW from '../../src/ui/screens/combat.ts?raw';
import LOBBY_RAW from '../../src/ui/screens/lobby.ts?raw';

/*
 * 重新整理接回的三條接線（推前稽核 2026-09-25 第四輪 低-3）：畫面那一層沒有瀏覽器環境跑不起來，
 * 這裡讀原始碼盯著，哪天有人拿掉其中一條就會紅。換行先統一（兩台 git 是 autocrlf，雲端是 LF）。
 */
const COMBAT = COMBAT_RAW.replace(/\r\n/g, '\n');
const LOBBY = LOBBY_RAW.replace(/\r\n/g, '\n');
const between = (src: string, start: string, end: string): string => {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`找不到這一段：${start}`);
  return src.slice(a, b);
};

describe('接回的接線', () => {
  it('戰鬥畫面在全滅、最後一關塔主打贏的那一刻就標成打完、清掉分頁記錄（不等收尾動畫）', () => {
    const over = between(COMBAT, '  function checkOver(): void {', '    const finish = ');
    expect(over).toMatch(/cs\.phase === 'lost'/);
    expect(over).toMatch(/bossWon && \(app\.run\?\.act \?\? 0\) >= ACTS/);
    expect(over).toMatch(/clearRejoin\(\);\s*session\.runOver\(\);/);
  });

  it('大廳：第一次記下存檔點之後才「離開不說 bye」；接回的會話當場就不說', () => {
    const make = between(LOBBY, 'function makeSession(', '\n}\n');
    expect(make).toMatch(/onCheckpoint: remember \? \(json, gen\) => \{ remember\(\{ checkpoint: json, gen \}\); tx\.stayOnReload\?\.\(true\); \}/);
    expect(make).toMatch(/if \(resume\) tx\.stayOnReload\?\.\(true\);/);
    expect(make, '建會話時不可以無條件打開').not.toMatch(/^\s*tx\.stayOnReload\?\.\(true\);/m);
  });

  it('大廳：連線戰鬥與選牌畫面重新整理先問一聲（2026-10-25），只在這個會話、整局還沒輸時問', () => {
    const make = between(LOBBY, 'function makeSession(', '\n}\n');
    const guard = between(make, "window.addEventListener('beforeunload'", '});');
    expect(guard).toMatch(/sameSession: app\.coop === session/);
    expect(guard).toMatch(/stopped: session\.stopped/);
    expect(guard).toMatch(/phase: app\.cs\?\.phase/);
    expect(guard).toMatch(/\}\)\) return;/);   // 判斷本身在 `shouldConfirmLeave`，測試見 leave_guard_1026.test.ts
    expect(guard).toMatch(/e\.preventDefault\(\);/);
  });

  it('大廳：重新同步收到地獄局而地獄包還沒載，先等載好（再驗一次遭遇）才 useRun（審查 2026-10-30 第 1 條）', () => {
    const resync = between(LOBBY, 'function resyncTo(', '\n}\n');
    const wait = resync.indexOf('app.whenHellReady(');
    expect(resync).toMatch(/if \(app\.hellPending\(run\.difficulty \?\? 1\)\)/);
    expect(wait).toBeGreaterThan(0);
    expect(wait, '等地獄包要在 useRun 之前').toBeLessThan(resync.indexOf('session.useRun(run)'));
    // 載好之後重跑一次 resyncTo：checkRun 這次會連遭遇一起驗（見 hell_unloaded_1024.test.ts）
    expect(between(resync, 'app.whenHellReady(', 'return;\n  }')).toMatch(/resyncTo\(app, session, seat, json, why\)/);
  });

  it('大廳：開新的一局先清掉上一局留在分頁裡的記錄，才建會話', () => {
    const start = between(LOBBY, 'function startCoop(', '\n}\n');
    const clearAt = start.indexOf('clearRejoin();');
    expect(clearAt).toBeGreaterThan(0);
    expect(clearAt).toBeLessThan(start.indexOf('makeSession('));
  });
});
