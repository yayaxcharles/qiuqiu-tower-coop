import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/manifest.json';
import { encounterById, encounters, encountersOfPool, enemyById, enemies } from '../../src/content/enemies';
import { hellEncounters, hellEnemies } from '../../src/content/enemies-hell';
import type { EnemyPool } from '../../src/engine/types';
import { generateMap, nodesOnFloor, poolForFloor, validateMap } from '../../src/engine/map';
import { Rng, seedFromString } from '../../src/engine/rng';
import { advanceAct, bossPoolForAct, newRun } from '../../src/engine/run';
import { rollQmark } from '../../src/engine/qmark';

const POOLS: EnemyPool[] = ['弱', '中', '強', '大魔物', '塔主'];

/** 地圖抽得到的一般戰池：第一關 弱／中／強；第二、三關只有 中／強（見 poolForFloor） */
const reachable = (act: number): EnemyPool[] => (act === 1 ? ['弱', '中', '強'] : ['中', '強']);

describe('地獄池：分池', () => {
  it('normalPoolsExcludeHell：一般難度的池完全不含地獄遭遇', () => {
    for (const p of POOLS) for (const a of [undefined, 1, 2, 3]) {
      expect(encountersOfPool(p, a).filter((e) => e.hell).map((e) => e.id), `${p} 第${a}關`).toEqual([]);
      expect(encountersOfPool(p, a, false).filter((e) => e.hell), `${p} 第${a}關 hell=false`).toEqual([]);
    }
  });

  it('hellPoolsOnlyHell：地獄池非空、而且全是地獄遭遇', () => {
    for (const a of [1, 2, 3]) {
      for (const p of [...reachable(a), '大魔物' as EnemyPool]) {
        const list = encountersOfPool(p, a, true);
        expect(list.length, `${p} 第${a}關`).toBeGreaterThan(0);
        expect(list.every((e) => e.hell === true), `${p} 第${a}關`).toBe(true);
      }
    }
    // 關主池：每一關各一隻
    expect(encountersOfPool('塔主', undefined, true).map((e) => e.id).sort())
      .toEqual(['hell_hoarder_toad', 'hell_hourglass_shogun', 'hell_source']);
  });

  it('bossPoolForAct：地獄每關一個專屬關主，一般難度不變', () => {
    expect(bossPoolForAct(1, true)).toEqual(['hell_hourglass_shogun']);
    expect(bossPoolForAct(2, true)).toEqual(['hell_hoarder_toad']);
    expect(bossPoolForAct(3, true)).toEqual(['hell_source']);
    expect(bossPoolForAct(3)).toEqual(['tower_master']);
    expect(bossPoolForAct(3, false)).toEqual(['tower_master']);
    expect(bossPoolForAct(1)).toHaveLength(5);
    expect(bossPoolForAct(2)).toHaveLength(5);
  });
});

describe('地獄池：地圖與問號格', () => {
  it('hellMapUsesHellEncounters：戰鬥、大魔物、塔主節點的遭遇都是地獄遭遇，地圖驗證沒有問題', () => {
    for (const act of [1, 2, 3]) {
      for (let i = 0; i < 12; i++) {
        const map = generateMap(new Rng(seedFromString(`h${i}`)), { act, hell: true, bossIds: bossPoolForAct(act, true), eliteMul: 1.6 });
        const fights = map.nodes.filter((n) => n.type === '戰鬥' || n.type === '大魔物' || n.type === '塔主');
        expect(fights.length).toBeGreaterThan(0);
        for (const n of fights) {
          const enc = encounterById[n.encounterId ?? ''];
          expect(enc?.hell, `第${act}關 ${n.id} ${n.encounterId}`).toBe(true);
          expect(enc!.acts, `${enc!.id}`).toEqual([act]);
        }
        expect(nodesOnFloor(map, 15)[0]!.encounterId).toBe(bossPoolForAct(act, true)[0]);
        expect(validateMap(map, act, true), `第${act}關 種子${i}`).toEqual([]);
      }
    }
  });

  it('一般難度的地圖絕不出現地獄遭遇（難度 1～5、三關）', () => {
    for (const d of [1, 3, 5]) for (const act of [1, 2, 3]) for (let i = 0; i < 20; i++) {
      const map = generateMap(new Rng(seedFromString(`n${d}-${i}`)), { act, bossIds: bossPoolForAct(act), difficulty: d, eliteMul: d >= 2 ? 1.6 : 1 });
      for (const n of map.nodes) if (n.encounterId) expect(encounterById[n.encounterId]?.hell, `${n.id}`).toBeFalsy();
      expect(validateMap(map, act)).toEqual([]);
    }
  });

  it('難度 6 開局與換關：地圖走地獄池、關主是地獄關主；難度 5 不是', () => {
    const r6 = newRun('hell-run', 6);
    for (const n of r6.map.nodes) if (n.encounterId) expect(encounterById[n.encounterId]?.hell, n.id).toBe(true);
    expect(nodesOnFloor(r6.map, 15)[0]!.encounterId).toBe('hell_hourglass_shogun');
    advanceAct(r6);
    expect(r6.act).toBe(2);
    for (const n of r6.map.nodes) if (n.encounterId) expect(encounterById[n.encounterId]?.hell, n.id).toBe(true);
    expect(nodesOnFloor(r6.map, 15)[0]!.encounterId).toBe('hell_hoarder_toad');
    advanceAct(r6);
    expect(nodesOnFloor(r6.map, 15)[0]!.encounterId).toBe('hell_source');
    const r5 = newRun('hell-run', 5);
    for (const n of r5.map.nodes) if (n.encounterId) expect(encounterById[n.encounterId]?.hell).toBeFalsy();
  });

  it('問號格伏擊：地獄時抽地獄一般池，一般難度照舊', () => {
    for (const [d, want] of [[6, true], [5, false]] as const) {
      const run = newRun('amb-hell', d);
      const n = run.map.nodes.find((x) => x.floor === 2)!;
      n.type = '事件';
      n.variant = '伏擊';
      rollQmark(run, n);
      const enc = encounterById[n.encounterId ?? ''];
      expect(enc, `d${d}`).toBeTruthy();
      expect(!!enc!.hell, `d${d}`).toBe(want);
      expect(enc!.pool).toBe(poolForFloor(n.floor, run.act));
    }
  });
});

/** FNV-1a：把一堆字串壓成一個 32 位元指紋 */
function fnv(parts: string[]): string {
  let h = 0x811c9dc5;
  for (const p of parts) for (let i = 0; i < p.length; i++) { h ^= p.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

describe('難度 1～5 不受地獄影響', () => {
  it('地圖與亂數用量跟加入地獄之前逐位元相同（指紋）', () => {
    const parts: string[] = [];
    for (const d of [1, 2, 3, 4, 5]) for (const act of [1, 2, 3]) for (let i = 0; i < 40; i++) {
      const rng = new Rng(seedFromString(`inv-${d}-${act}-${i}`));
      const map = generateMap(rng, { act, bossIds: bossPoolForAct(act), difficulty: d, eliteMul: d >= 2 ? 1.6 : 1, flags: {}, hero: i % 2 ? 'ninja' : null });
      parts.push(JSON.stringify(map.nodes.map((n) => [n.id, n.type, n.encounterId, n.modifier, n.eventId, n.next])));
      parts.push(JSON.stringify(rng.state));
    }
    for (const d of [1, 2, 3, 4, 5]) for (let i = 0; i < 20; i++) {
      const run = newRun(`inv-run-${d}-${i}`, d);
      parts.push(JSON.stringify(run.map.nodes.map((n) => [n.id, n.type, n.encounterId, n.modifier, n.eventId])), JSON.stringify(run.rng));
      advanceAct(run);
      parts.push(JSON.stringify(run.map.nodes.map((n) => [n.id, n.type, n.encounterId, n.modifier, n.eventId])), JSON.stringify(run.rng));
    }
    expect(fnv(parts)).toBe('36ec878');
  });
});

describe('地獄魔物資料', () => {
  /** 待機原圖寬度（tools/pack_hell_art.py 的體型表）：512＝small、768＝medium、1024＝large。原圖夾不進版控，所以寫死在這裡 */
  const SMALL = ['banner_imp', 'candle_monk', 'dice_goblin', 'fuse_imp', 'geta_runner', 'medicine_bat', 'mirror_eye', 'ofuda_ghost',
    'onibi_rats', 'paper_crane', 'spark_beetle', 'spy_crow', 'trash_goblin', 'vengeful_doll'];
  const LARGE = ['bone_commander', 'card_dragon', 'chain_warden', 'clock_oni', 'hoarder_toad', 'hourglass_shogun', 'nue', 'rush_boar',
    'sand_golem', 'source', 'three_face_ashura', 'vault_tortoise'];
  const ACT = {
    1: { normal: ['fuse_imp', 'hourglass_moth', 'loot_weasel', 'drum_tanuki', 'onibi_rats', 'candle_monk', 'fire_wheel', 'miasma_bud', 'spark_beetle', 'geta_runner', 'ember_snail', 'conch_oni'],
      elite: ['clock_oni', 'rush_boar', 'sand_golem'], boss: 'hourglass_shogun' },
    2: { normal: ['pickpocket_monkey', 'ofuda_ghost', 'magpie_tengu', 'junk_mimic', 'ink_octopus', 'lock_spider', 'shuffle_fox', 'trash_goblin', 'paper_crane', 'ink_brush', 'dice_goblin', 'umbrella_thief'],
      elite: ['vault_tortoise', 'card_dragon', 'chain_warden'], boss: 'hoarder_toad' },
    3: { normal: ['shell_kappa', 'banner_imp', 'medicine_bat', 'twin_moon', 'twin_sun', 'mirror_eye', 'strategist_owl', 'smoke_rat', 'spy_crow', 'kagemusha_cat', 'war_drum_frog', 'vengeful_doll'],
      elite: ['three_face_ashura', 'nue', 'bone_commander'], boss: 'source' },
  } as const;

  it('名單：每關 12 隻一般＋3 隻大魔物＋1 隻關主，共 48 種，編號都是 hell_ 開頭且不跟舊魔物撞', () => {
    const want = Object.values(ACT).flatMap((a) => [...a.normal, ...a.elite, a.boss]).map((n) => `hell_${n}`);
    expect(hellEnemies.map((e) => e.id).sort()).toEqual([...want].sort());
    expect(new Set(hellEnemies.map((e) => e.id)).size).toBe(48);
    for (const e of hellEnemies) expect(enemyById[e.id], e.id).toBe(e);
    expect(enemies.filter((e) => !e.id.startsWith('hell_')).length).toBe(enemies.length - 48);
    const oldNames = new Set(enemies.filter((e) => !e.id.startsWith('hell_')).map((e) => e.name));
    for (const e of hellEnemies) expect(oldNames.has(e.name), `名字跟舊魔物重複：${e.name}`).toBe(false);
    expect(new Set(hellEnemies.map((e) => e.name)).size).toBe(48);
  });

  it('池別：一般＝弱中強、大魔物＝大魔物、關主＝塔主；血量區間合法、有台詞、有招式', () => {
    for (const a of [1, 2, 3] as const) {
      const spec = ACT[a];
      for (const n of spec.normal) expect(['弱', '中', '強'], n).toContain(enemyById[`hell_${n}`]!.pool);
      for (const n of spec.elite) expect(enemyById[`hell_${n}`]!.pool, n).toBe('大魔物');
      expect(enemyById[`hell_${spec.boss}`]!.pool).toBe('塔主');
    }
    for (const e of hellEnemies) {
      expect(e.hp[0], e.id).toBeGreaterThan(0);
      expect(e.hp[1], e.id).toBeGreaterThanOrEqual(e.hp[0]);
      expect(e.moves.length, e.id).toBeGreaterThan(0);
      expect(e.line.length, e.id).toBeGreaterThan(0);
      expect(e.art, e.id).toBe(`codex/monster_${e.id}`);
    }
  });

  it('體型跟待機原圖寬度對得上（512 small、768 medium、1024 large）', () => {
    for (const e of hellEnemies) {
      const base = e.id.replace(/^hell_/, '');
      const want = SMALL.includes(base) ? 'small' : LARGE.includes(base) ? 'large' : 'medium';
      expect(e.size, e.id).toBe(want);
    }
  });

  it('everyHellEnemyHasArtKeyAndSize：48 個魔物的 art 都登記在 manifest 的 monsters，而且有待機（體型見上一條）', () => {
    const monsters = manifest.monsters as Record<string, Record<string, string>>;
    for (const e of hellEnemies) {
      expect(e.art, e.id).toBe(`codex/monster_${e.id}`);
      expect(monsters[e.art]?.idle, `${e.id} 沒登記待機`).toBeTruthy();
    }
  });

  it('遭遇：全是 hell、acts 只有自己那一關、成員存在、召喚物存在、池不低於成員', () => {
    expect(hellEncounters.every((e) => e.hell === true)).toBe(true);
    const order: EnemyPool[] = ['弱', '中', '強'];
    for (const enc of hellEncounters) {
      expect(encounterById[enc.id], enc.id).toBe(enc);
      expect(enc.id.startsWith('hell_'), enc.id).toBe(true);
      expect(enc.acts?.length, enc.id).toBe(1);
      const act = enc.acts![0]!;
      const spec = ACT[act as 1 | 2 | 3];
      for (const id of enc.enemies) {
        const def = enemyById[id];
        expect(def, `${enc.id} → ${id}`).toBeTruthy();
        expect([...spec.normal, ...spec.elite, spec.boss].map((n) => `hell_${n}`), `${enc.id} 的 ${id} 不是這一關的魔物`).toContain(id);
        if (enc.pool === '弱' || enc.pool === '中' || enc.pool === '強') {
          expect(order.indexOf(enc.pool) - order.indexOf(def!.pool), `${enc.id}：${id}（${def!.pool}）不該在 ${enc.pool} 遭遇`).toBeGreaterThanOrEqual(0);
        }
      }
      for (const id of enc.enemies) for (const m of enemyById[id]!.moves) for (const fx of m.effects) {
        if (fx.kind === 'summon') expect(enemyById[fx.enemyId], `${id} 召喚`).toBeTruthy();
      }
    }
  });

  it('每一關：地圖抽得到的池都有單隻與組合；大魔物就是那三隻；第三關組合佔一半以上', () => {
    for (const a of [1, 2, 3] as const) {
      for (const p of reachable(a)) {
        const list = encountersOfPool(p, a, true);
        expect(list.some((e) => e.enemies.length === 1), `第${a}關 ${p} 單隻`).toBe(true);
        expect(list.some((e) => e.enemies.length >= 2), `第${a}關 ${p} 組合`).toBe(true);
      }
      expect(encountersOfPool('大魔物', a, true).map((e) => e.enemies.join()).sort()).toEqual(ACT[a].elite.map((n) => `hell_${n}`).sort());
      const normals = reachable(a).flatMap((p) => encountersOfPool(p, a, true));
      // 每隻一般魔物至少在一場遭遇裡出現
      const used = new Set(normals.flatMap((e) => e.enemies));
      for (const n of ACT[a].normal) expect(used.has(`hell_${n}`), `第${a}關 ${n} 沒有遭遇`).toBe(true);
      if (a === 3) expect(normals.filter((e) => e.enemies.length >= 2).length * 2, '第三關多隻同場').toBeGreaterThanOrEqual(normals.length);
    }
  });

  it('shared arrays：地獄遭遇已併進 encounters，一般池原順序不變', () => {
    expect(encounters.filter((e) => e.hell).length).toBe(hellEncounters.length);
    expect(encounters.slice(0, encounters.length - hellEncounters.length).some((e) => e.hell)).toBe(false);
  });
});

describe('地獄魔物的量級：同關同池跟一般難度差不到一成', () => {
  /** 一組遭遇的總血量：成員血量區間中點相加，乘遭遇的 hpScale */
  const hpOf = (enc: (typeof encounters)[number]): number =>
    enc.enemies.reduce((s, id) => s + (enemyById[id]!.hp[0] + enemyById[id]!.hp[1]) / 2, 0) * (enc.hpScale ?? 1);
  /** 一組遭遇每回合的平均傷害：每位成員把招式表裡傷害招式（段數 × 每段，每段加遭遇的魔氣）平均；沒傷害的招式算 0 */
  const dmgOf = (enc: (typeof encounters)[number]): number => enc.enemies.reduce((s, id) => {
    const moves = enemyById[id]!.moves;
    const per = moves.reduce((a, mv) => a + mv.effects.reduce((b, fx) => {
      if (fx.kind === 'damage') return b + (fx.amount + (enc.strength ?? 0)) * (fx.times ?? 1);
      if (fx.kind === 'damageRandom') return b + (fx.min + fx.max) / 2 + (enc.strength ?? 0);
      if (fx.kind === 'selfDestruct') return b + fx.amount;
      return b;
    }, 0), 0);
    return s + per / moves.length;
  }, 0);
  const avg = (list: (typeof encounters), f: (e: (typeof encounters)[number]) => number): number => list.reduce((s, e) => s + f(e), 0) / list.length;

  const groups: [number, EnemyPool][] = [[1, '弱'], [1, '中'], [1, '強'], [1, '大魔物'], [2, '中'], [2, '強'], [2, '大魔物'], [3, '中'], [3, '強'], [3, '大魔物']];
  for (const [act, pool] of groups) {
    it(`第${act}關 ${pool}：平均總血量與每回合傷害跟一般難度差在 ±10% 內`, () => {
      const van = encountersOfPool(pool, act, false), hel = encountersOfPool(pool, act, true);
      expect(van.length).toBeGreaterThan(0);
      expect(hel.length).toBeGreaterThan(0);
      const hp = avg(hel, hpOf) / avg(van, hpOf);
      const dmg = avg(hel, dmgOf) / avg(van, dmgOf);
      expect(hp, `血量比 ${hp.toFixed(2)}`).toBeGreaterThanOrEqual(0.9);
      expect(hp, `血量比 ${hp.toFixed(2)}`).toBeLessThanOrEqual(1.1);
      expect(dmg, `傷害比 ${dmg.toFixed(2)}`).toBeGreaterThanOrEqual(0.9);
      expect(dmg, `傷害比 ${dmg.toFixed(2)}`).toBeLessThanOrEqual(1.1);
    });
  }
});
