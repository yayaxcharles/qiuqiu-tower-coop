import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * 地獄（難度 6）不播開頭影片與序章幻燈片（使用者 2026-10-26：「地獄模式開頭還用那個好怪」「開頭就不要那些說明了」）。
 * 畫面層沒有瀏覽器跑不起來，照倉庫慣例讀原始碼確認接法。
 */
const APP = readFileSync('src/ui/app.ts', 'utf8').replace(/\r\n/g, '\n');
const PICK = readFileSync('src/ui/screens/heroselect.ts', 'utf8').replace(/\r\n/g, '\n');

describe('地獄不播序章', () => {
  it('playPrologue：地獄在播影片與幻燈片之前就切第一關曲、直接接下去', () => {
    const body = APP.slice(APP.indexOf('  playPrologue(hero: Hero'), APP.indexOf('  syncStory('));
    const skip = body.indexOf("if (runMods(run).hellMode) { setBgm('act1'); after(); return; }");
    expect(skip).toBeGreaterThan(0);
    expect(skip).toBeGreaterThan(body.indexOf("run.flags['prologue'] = true"));   // 旗標照設：續玩、連線接回不會再播
    expect(skip).toBeLessThan(body.indexOf('const pro = storyFor(hero).prologue'));
    expect(skip).toBeLessThan(body.indexOf('playVideo(clip, play)'));
  });

  it('選角畫面：地獄不先抓序章的圖，改先抓包袱畫面與主圖', () => {
    expect(PICK).toMatch(/if \(!difficultyMods\(difficulty \?\? 1\)\.hellMode\) warmSlides\(prologueSlides\(chosen\)\);/);
    expect(PICK).toMatch(/else \{ void loadBlessingScreen\(\)[^\n]*eventArtKey\('bless_bundle', chosen\)/);
  });
});
