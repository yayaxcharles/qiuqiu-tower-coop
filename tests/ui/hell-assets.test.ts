// 難度 6「地獄」的圖：進倉登記、預載分流、戰鬥背景（Task 3）
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../public/assets/manifest.json';
import { hellEnemies } from '../../src/content/enemies-hell';
import { enemyById } from '../../src/content/enemies';
import { _setManifestForTest, hasMonsterPose, monsterPhaseKey, type Manifest } from '../../src/ui/assets';
import { bgKeysForAct, deferredBgKeys, hellBgKey, hellBgKeys } from '../../src/ui/bgacts';
import { enemyIdsForAct, firstFightUrls, monsterArtKeysForAct } from '../../src/ui/preload';
import { battleBgKey, tierBgKey } from '../../src/ui/screenbg';

const ALL_HELL_BG = [1, 2, 3].flatMap((a) => ['', '_2', '_3'].map((v) => `bg/bg_hell_${a}${v}`));
const mf = manifest as unknown as { monsters: Record<string, Record<string, string>>; bg: Record<string, string> };

beforeAll(() => { _setManifestForTest(manifest as unknown as Manifest); });

describe('地獄圖片進倉', () => {
  it('每隻地獄魔物都有立繪鍵，待機到齊，檔案真的存在', () => {
    expect(hellEnemies.length).toBe(48);
    for (const e of hellEnemies) {
      expect(e.art, e.id).toBe(`codex/monster_${e.id}`);
      const poses = mf.monsters[e.art];
      expect(poses?.idle, `${e.id} 沒登記待機`).toBeTruthy();
      for (const p of ['idle', 'attack', 'hurt', 'block']) expect(hasMonsterPose(e.art, p as 'idle'), `${e.id}/${p}`).toBe(true);
      for (const rel of Object.values(poses!)) expect(existsSync(new URL(`../../public/${rel}`, import.meta.url)), rel).toBe(true);
    }
  });

  it('魔源的換階段立繪登記成 monsterPhaseKey 查得到的形式（_p2～_p4），之後換階段不必動圖', () => {
    const art = 'codex/monster_hell_source';
    expect(monsterPhaseKey(art, 1)).toBe(`${art}_p2`);
    expect(monsterPhaseKey(art, 2)).toBe(`${art}_p3`);
    expect(monsterPhaseKey(art, 3)).toBe(`${art}_p4`);
    for (const p of [2, 3, 4]) for (const pose of ['idle', 'attack', 'hurt', 'block']) {
      expect(hasMonsterPose(`${art}_p${p}`, pose as 'idle'), `p${p}/${pose}`).toBe(true);
    }
    expect(hasMonsterPose(`${art}_p4`, 'down')).toBe(true);   // 最後一個形態才有倒下那張
  });

  it('九張地獄背景都登記了、檔案存在，而且一般難度的背景鍵沒被動到', () => {
    for (const k of ALL_HELL_BG) {
      expect(mf.bg[k], k).toBeTruthy();
      expect(existsSync(new URL(`../../public/${mf.bg[k]}`, import.meta.url)), k).toBe(true);
    }
    for (const k of ['bg/low', 'bg/mid', 'bg/top', 'bg/art26_low_1', 'bg/boss1']) expect(mf.bg[k], k).toBeTruthy();
  });
});

describe('地獄背景', () => {
  it('hellArtNotInFirstLoad：九張地獄背景都在延後名單（開場不載）', () => {
    const skip = deferredBgKeys();
    for (const k of ALL_HELL_BG) expect(skip.has(k), k).toBe(true);
  });

  it('每關三張、照樓層輪（同一層永遠同一張、不用亂數）、換關換色', () => {
    expect(hellBgKeys(1)).toEqual(['bg/bg_hell_1', 'bg/bg_hell_1_2', 'bg/bg_hell_1_3']);
    // 第 1 層看到基底那張，之後 2、3 層換另外兩張，第 4 層輪回來
    expect([1, 2, 3, 4].map(hellBgKey)).toEqual(['bg/bg_hell_1', 'bg/bg_hell_1_2', 'bg/bg_hell_1_3', 'bg/bg_hell_1']);
    expect([15, 16, 17, 18].map(hellBgKey)).toEqual(['bg/bg_hell_1_3', 'bg/bg_hell_2', 'bg/bg_hell_2_2', 'bg/bg_hell_2_3']);
    expect([30, 31, 45].map(hellBgKey)).toEqual(['bg/bg_hell_2_3', 'bg/bg_hell_3', 'bg/bg_hell_3_3']);
    // 全部 45 層走過，九張都輪得到
    expect(new Set(Array.from({ length: 45 }, (_, i) => hellBgKey(i + 1)))).toEqual(new Set(ALL_HELL_BG));
  });

  it('戰鬥與獎勵共用的 tierBgKey／battleBgKey：地獄走地獄背景（含關主戰），一般難度一個字都不變', () => {
    for (let f = 1; f <= 45; f++) {
      expect(tierBgKey(f, true), `F${f}`).toBe(hellBgKey(f));
      expect(battleBgKey(Math.ceil(f / 15), f, false, true)).toBe(hellBgKey(f));
      expect(tierBgKey(f).startsWith('bg/bg_hell_')).toBe(false);
      expect(tierBgKey(f)).toBe(tierBgKey(f, false));
    }
    for (const act of [1, 2, 3]) {
      expect(battleBgKey(act, act * 15, true, true)).toBe(hellBgKey(act * 15));   // 關主戰也是地獄背景（沒有專屬關主戰場）
      expect(battleBgKey(act, act * 15, true).startsWith('bg/bg_hell_')).toBe(false);
    }
  });

  it('一般難度：每一關要預載的底圖清單裡沒有任何地獄背景', () => {
    for (const act of [0, 1, 2, 3, 4]) expect(bgKeysForAct(act).some((k) => k.includes('hell')), `act${act}`).toBe(false);
  });

  it('地獄預載的底圖：有該關那三張地獄戰鬥背景，沒有一般難度的戰鬥背景，地圖與節點畫面照舊', () => {
    for (const act of [1, 2, 3]) {
      const keys = bgKeysForAct(act, true);
      expect(keys).toEqual(expect.arrayContaining(hellBgKeys(act)));
      expect(keys.filter((k) => /^bg\/(low|mid|top|boss\d|art26_(low|mid|top)_\d)/.test(k)), `act${act}`).toEqual([]);
      for (const k of keys) expect(mf.bg[k], k).toBeTruthy();
      for (const k of ['bg/map_tall', 'bg/screen_event', 'bg/screen_rest']) expect(keys.some((x) => x.startsWith(k)), k).toBe(true);
      expect(keys).toContain(`bg/door_act${act}`);
    }
  });
});

describe('地獄魔物預載', () => {
  it('preloadActHellOnlyHellArt：地獄只載地獄魔物，一般難度一隻地獄魔物都沒有', () => {
    for (const act of [1, 2, 3]) {
      const hell = enemyIdsForAct(act, true);
      expect(hell.size, `act${act}`).toBeGreaterThan(14);
      for (const id of hell) expect(id.startsWith('hell_'), id).toBe(true);
      for (const id of enemyIdsForAct(act)) expect(id.startsWith('hell_'), `一般難度第${act}關 ${id}`).toBe(false);
      for (const id of enemyIdsForAct(act, false)) expect(id.startsWith('hell_'), id).toBe(false);
    }
  });

  it('地獄每一關：該關的一般、大魔物、關主都在，別關的不在', () => {
    const a1 = enemyIdsForAct(1, true), a2 = enemyIdsForAct(2, true), a3 = enemyIdsForAct(3, true);
    for (const id of ['hell_fuse_imp', 'hell_conch_oni', 'hell_clock_oni', 'hell_hourglass_shogun']) expect(a1.has(id), id).toBe(true);
    for (const id of ['hell_paper_crane', 'hell_vault_tortoise', 'hell_hoarder_toad']) expect(a2.has(id), id).toBe(true);
    for (const id of ['hell_spy_crow', 'hell_nue', 'hell_source']) expect(a3.has(id), id).toBe(true);
    expect(a1.has('hell_hoarder_toad')).toBe(false);
    expect(a2.has('hell_source')).toBe(false);
    expect(a3.has('hell_fuse_imp')).toBe(false);
    // 四十八種（含魔源本體）一般＋大魔物＋關主加起來，三關各自的名單合起來就是全部（召喚物也算進去）
    const all = new Set([...a1, ...a2, ...a3]);
    for (const e of hellEnemies) expect(all.has(e.id), e.id).toBe(true);
  });

  it('地獄預載的立繪鍵每一個都在 manifest 裡（缺圖會退成灰剪影）', () => {
    for (const act of [1, 2, 3]) for (const key of monsterArtKeysForAct(act, true)) expect(mf.monsters[key], key).toBeTruthy();
  });

  it('sourcePhasesPreloaded：魔源有換階段（Task 7）時，p2～p4 的立繪鍵跟著進預載清單', () => {
    const phases = enemyById.hell_source!.phases?.length ?? 0;
    const keys = monsterArtKeysForAct(3, true);
    expect(keys).toContain('codex/monster_hell_source');
    // 魔源已接三個換形態階段：有幾個階段就要有幾個鍵，剛好是 p2～p4
    for (let p = 1; p <= phases; p++) expect(keys, `p${p + 1}`).toContain(`codex/monster_hell_source_p${p + 1}`);
  });

  it('一般難度的立繪預載清單沒有任何 hell_ 鍵（d1～5 的預載集合不變）', () => {
    for (const act of [1, 2, 3]) {
      for (const key of monsterArtKeysForAct(act)) expect(key.includes('hell_'), key).toBe(false);
      for (const key of monsterArtKeysForAct(act, false)) expect(key.includes('hell_'), key).toBe(false);
    }
    for (const url of firstFightUrls()) expect(url.includes('hell_'), url).toBe(false);
  });

  it('開場那批（封面時就抓的第一關弱魔物）沒有地獄圖；地獄版自己有一份', () => {
    expect(firstFightUrls().some((u) => u.includes('hell_'))).toBe(false);
    const hell = firstFightUrls(true);
    expect(hell.length).toBeGreaterThan(5);
    for (const u of hell) expect(u.includes('hell_'), u).toBe(true);
  });
});

describe('地獄預載的接線（原始碼層）', () => {
  const src = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf-8').replace(/\r\n/g, '\n');

  it('進入一局、過關、網路載入的後備都把難度 6 傳進預載', () => {
    expect(src('src/ui/netload-run.ts')).toContain('d.preloadHeroArt(run.players.map((p) => p.hero), run.act, runMods(run).hellMode)');
    expect(src('src/ui/netload.ts')).toContain('preloadHeroArt(run.players.map((p) => p.hero), run.act, runMods(run).hellMode)');
    expect(src('src/ui/screens/actclear.ts')).toContain('preloadAct(run.act + 1, run.players[0]?.hero, runMods(run).hellMode)');
  });

  it('戰鬥、獎勵、關主門、過關轉場都用地獄背景', () => {
    expect(src('src/ui/screens/combat.ts')).toContain("battleBgKey(run.act, run.floor, encounterById[cs.encounterId]?.pool === '塔主', runMods(run).hellMode)");
    expect(src('src/ui/screens/bossdoor.ts')).toContain('battleBgKey(run.act, run.floor, true, runMods(run).hellMode)');
    expect(src('src/ui/screens/reward.ts')).toContain('tierBgKey(app.run?.floor ?? 1, !!app.run && runMods(app.run).hellMode)');
    expect(src('src/ui/screens/actclear.ts')).toContain('actWalkTransition(app.stage, run.floor + 1,');
    expect(src('src/ui/screens/actclear.ts')).toContain('runMods(run).hellMode');
  });

  it('地圖紫黑色調只在地獄加 class，樣式只疊一層半透明色、不用濾鏡', () => {
    expect(src('src/ui/screens/map.ts')).toContain('map-hell');
    const css = src('src/ui/styles/map.css');
    expect(css).toContain('.map-hell');
    const at = css.indexOf('.map-hell .map-bg::after');
    const block = css.slice(at, css.indexOf('}', at));
    expect(block).toContain('background:');
    expect(block).not.toMatch(/filter\s*:/);
  });
});
