/**
 * 地獄最後一關的關主門先抓塔頂段與結局開頭的圖（稽核 2026-10-26 第 4 條）。
 * 慢網路下推門、塔頂段一開播最多只等 1.2 秒就顯示，圖沒到會先出空底圖。
 * 守三件事：①地獄第三關抓的就是這一局會播的那兩張（單人四款、連線六組、同角色雙人）；
 * ②難度 1～5 與地獄前兩關一張都不多抓；③關主門真的有叫，而且只在地獄叫。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BOSSDOOR_RAW from '../../src/ui/screens/bossdoor.ts?raw';
import { setCoopStory } from '../../src/content/dialogue';
import { starterDeckFor } from '../../src/content/cards';
import { _setManifestForTest, artUrl, warmed } from '../../src/ui/assets';
import { warmHellStory } from '../../src/ui/preload';
import { endingSlides, hellTopSceneSlides } from '../../src/ui/storyslides';

const BOSSDOOR = BOSSDOOR_RAW.replace(/\r\n/g, '\n');
type H = 'ninja' | 'feifei' | 'dangdang' | 'fengfeng';
const HEROES: H[] = ['ninja', 'feifei', 'dangdang', 'fengfeng'];
const coop = (partner: string | null): void => (setCoopStory as unknown as (x: unknown) => void)(partner ? { partner } : null);

class FakeImage {
  static made: string[] = [];
  private _src = '';
  get src(): string { return this._src; }
  set src(v: string) { this._src = v; FakeImage.made.push(v); }
  async decode(): Promise<void> { /* 立即完成 */ }
}

beforeEach(() => {
  const bg: Record<string, string> = {};
  for (const h of ['', 'feifei_', 'dangdang_', 'fengfeng_']) for (const n of ['still_hell_top', 'still_corrupt']) bg[`bg/${h}${n}`] = `assets/bg/${h}${n}.webp`;
  for (const a of ['feifei_coop_ninja', 'dangdang_coop_ninja', 'dangdang_coop_feifei', 'fengfeng_coop_ninja', 'fengfeng_coop_feifei', 'fengfeng_coop_dangdang']) {
    for (const n of ['hell_top', 'corrupt']) bg[`bg/${a}_${n}`] = `assets/bg/${a}_${n}.webp`;
  }
  _setManifestForTest({ cards: {}, sprites: {}, monsters: {}, icons: {}, bg, review: [] });
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => {
  coop(null);
  warmed.clear();
  FakeImage.made = [];
  vi.unstubAllGlobals();
});

const deckOf = (h: H): string[] => [...starterDeckFor(h)];
const fetched = (): string[] => [...FakeImage.made].sort();
const want = (...keys: string[]): string[] => keys.map((k) => artUrl('bg', k)).sort();

describe('地獄第三關：抓這一局會播的塔頂段與結局開頭兩張', () => {
  it.each(HEROES)('單人 %s：只抓自己版本的兩張', async (h) => {
    coop(null);
    expect(warmHellStory(3, true, h)).toBe(true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const top = hellTopSceneSlides(h)[0]!.img;
    const corrupt = endingSlides(h, deckOf(h), 6)[0]!.img;
    expect(corrupt, '結局第一張就是被魔氣纏住那張').toContain('corrupt');
    expect(fetched()).toEqual(want(top, corrupt));
  });

  const PAIRS: [H, H][] = [];
  for (const a of HEROES) for (const b of HEROES) if (a < b) PAIRS.push([a, b]);
  it.each(PAIRS.flatMap(([a, b]) => [[a, b], [b, a]] as [H, H][]))('連線 %s＋%s：抓這一組的兩張，別組的不抓', async (me, other) => {
    coop(other);
    expect(warmHellStory(3, true, me)).toBe(true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const top = hellTopSceneSlides(me)[0]!.img;
    const corrupt = endingSlides(me, deckOf(me), 6)[0]!.img;
    expect(corrupt).toContain('corrupt');
    expect(fetched()).toEqual(want(top, corrupt));
  });

  it('同角色雙人走單人那份', async () => {
    coop('dangdang');
    warmHellStory(3, true, 'dangdang');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(fetched()).toEqual(want('bg/dangdang_still_hell_top', 'bg/dangdang_still_corrupt'));
  });
});

describe('難度 1～5 與地獄前兩關不多抓', () => {
  it.each([1, 2, 3])('非地獄第 %s 關：不建任何圖片', async (act) => {
    expect(warmHellStory(act, false, 'ninja')).toBe(false);
    await Promise.resolve();
    expect(FakeImage.made).toEqual([]);
  });
  it.each([1, 2])('地獄第 %s 關：還不抓（塔頂段在第三關）', async (act) => {
    expect(warmHellStory(act, true, 'ninja')).toBe(false);
    await Promise.resolve();
    expect(FakeImage.made).toEqual([]);
  });
});

describe('關主門接線', () => {
  it('原本的過關幻燈片預載照舊，地獄的另外叫一次，且把「是不是地獄」交給 warmHellStory 判斷', () => {
    expect(BOSSDOOR).toContain('  warmSlides(run.act);\n');
    expect(BOSSDOOR).toContain('warmHellStory(run.act, runMods(run).hellMode);');
  });
});
