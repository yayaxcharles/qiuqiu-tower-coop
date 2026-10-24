import { describe, expect, it } from 'vitest';
import { STARTER_DECK } from '../../src/content/cards';
import { enemyById } from '../../src/content/enemies';
import { damageEnemy } from '../../src/engine/actions';
import { COOP_HP_BY_ENCOUNTER } from '../../src/engine/coopscale';
import { endTurn, playCard, startCombat } from '../../src/engine/combat';
import { cunningActive, formMechs, hellDrawPenalty, mechActive, SOURCE_MIASMA_TURNS, tauntingEnemy } from '../../src/engine/hell';
import { learnsPlayerCards } from '../../src/engine/mimic';
import { Rng, seedFromString } from '../../src/engine/rng';
import { advanceAct, beginCombat, finishCombat, newRun } from '../../src/engine/run';
import { getStatus } from '../../src/engine/statuses';
import type { CombatState, EnemyCombat } from '../../src/engine/types';
import { nodesOnFloor } from '../../src/engine/map';
import { inst } from '../helpers';

const SOURCE = 'hell_source';
const BARS = [120, 150, 170, 220];

function start(encounterId = SOURCE, hell: false | { act: 1 | 2 | 3 } = { act: 3 }, seed = 'src'): CombatState {
  return startCombat({
    hp: 9999, maxHp: 9999, deck: STARTER_DECK.map((id, i) => inst(id, i + 1)), relics: [], potions: [], encounterId,
    rng: new Rng(seedFromString(seed)), ...(hell ? { hell } : {}),
  });
}

/** 打掉現在這一條血（直傷，不吃看穿、防禦）。回換形態之後的魔源 */
function breakBar(cs: CombatState, e: EnemyCombat): void {
  e.block = 0;
  damageEnemy(cs, e, 99999, { direct: true, by: cs.player });
}

/** 一路打到第 n 形態（1～4），中間每次換形態都等調息的那一回合過去，回魔源 */
function toForm(cs: CombatState, n: number): EnemyCombat {
  const e = cs.enemies.find((x) => x.enemyId === SOURCE)!;
  while (e.phase < n - 1) {
    breakBar(cs, e);
    e.invulnIn = 0;   // 蹲下調息的無敵不在這裡測
    e.moveIndex = -1;
    endTurn(cs);       // 調息那一回合過去
  }
  return e;
}

describe('魔源：四形態血條', () => {
  it('fourFormsViaHpBar：打完三條血只是換形態，第四條打完才倒下，通關', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    expect(e.maxHp).toBe(BARS[0]);
    for (let i = 1; i <= 3; i++) {
      breakBar(cs, e);
      expect(e.dead, `第 ${i} 條打完不能倒`).toBe(false);
      expect(e.phase).toBe(i);
      expect(e.hp).toBe(BARS[i]);
      expect(e.maxHp).toBe(BARS[i]);
      expect(e.invulnIn).toBe(1);
      expect(cs.phase).not.toBe('won');
      e.invulnIn = 0;
    }
    breakBar(cs, e);
    expect(e.dead).toBe(true);
    expect(cs.phase).toBe('won');
  });

  it('總血量落在師父（120＋240＋300）的量級、明顯高過第二關關主', () => {
    const def = enemyById[SOURCE]!;
    const total = def.hp[0] + def.phases!.reduce((s, p) => s + p.hpBar!, 0);
    expect(total).toBe(BARS.reduce((a, b) => a + b, 0));
    expect(total).toBeGreaterThanOrEqual(600);
    expect(total).toBeLessThanOrEqual(720);
    expect(total).toBeGreaterThan(enemyById['hell_hoarder_toad']!.hp[1] * 2);
    expect(def.phases).toHaveLength(3);
    expect(def.phases!.every((p) => p.hpBar !== undefined)).toBe(true);
  });

  it('只有第四形態有倒下圖（前三形態不可能被打倒：每條血都走 hpBar）', () => {
    const def = enemyById[SOURCE]!;
    expect(def.phases!.map((p) => p.hellMech)).toEqual([['chaos'], ['cunning'], ['miasma', 'chaos', 'cunning']]);
    expect(def.phases!.map((p) => p.learnsPlayerCards === true)).toEqual([false, false, true]);
  });
});

describe('魔源：形態機制＝關數給的 ∪ 形態給的', () => {
  it('phase1HasMiasmaInAct3：第三關開場就有紫霧，倒數比一般關主短 2 回合', () => {
    const cs = start();
    expect(SOURCE_MIASMA_TURNS).toBe(8);
    expect(cs.hell?.miasmaLeft).toBe(SOURCE_MIASMA_TURNS);
    expect(hellDrawPenalty(cs)).toBe(0);
    for (let i = 0; i < SOURCE_MIASMA_TURNS; i++) endTurn(cs);
    expect(cs.hell?.miasmaLeft).toBe(0);
    expect(hellDrawPenalty(cs)).toBe(1);
    expect(getStatus(cs.enemies[0]!, '爪力')).toBeGreaterThanOrEqual(2);
  });

  it('第三關其他魔物（不是魔源）沒有紫霧：形態機制只看魔源自己的資料', () => {
    expect(start('hell_spy_crow', { act: 3 }).hell?.miasmaLeft).toBeUndefined();
    expect(start('hell_spy_crow', { act: 3 }).hell).toEqual({ act: 3 });
  });

  it('進第二形態：紫霧清掉、抽牌處罰結束、寫戰報', () => {
    const cs = start();
    for (let i = 0; i < SOURCE_MIASMA_TURNS; i++) endTurn(cs);
    expect(hellDrawPenalty(cs)).toBe(1);
    const e = cs.enemies[0]!;
    const before = cs.log.length;
    breakBar(cs, e);
    expect(cs.hell?.miasmaLeft).toBeUndefined();
    expect(hellDrawPenalty(cs)).toBe(0);
    expect(cs.log.slice(before).some((l) => l.includes('紫霧散開'))).toBe(true);
    expect(mechActive(cs, 'chaos')).toBe(true);
  });

  it('第二、三形態沒有紫霧；第四形態重新起算 8 回合並寫戰報', () => {
    const cs = start();
    const e = toForm(cs, 3);
    expect(cs.hell?.miasmaLeft).toBeUndefined();
    expect(formMechs(e)).toEqual(['cunning']);
    const before = cs.log.length;
    breakBar(cs, e);
    expect(e.phase).toBe(3);
    expect(cs.hell?.miasmaLeft).toBe(SOURCE_MIASMA_TURNS);
    expect(cs.log.slice(before).some((l) => l.includes('紫霧又聚攏'))).toBe(true);
  });

  it('phase4MimicsLastTurnAndAllMechs：真身三種機制都開、照抄玩家上一回合打出的牌', () => {
    const cs = start();
    const e = toForm(cs, 3);
    breakBar(cs, e);
    e.invulnIn = 0;
    expect(learnsPlayerCards(e)).toBe(true);
    for (const m of ['miasma', 'chaos', 'cunning'] as const) expect(mechActive(cs, m), m).toBe(true);
    // 形態一～三不學、真身才學
    expect(learnsPlayerCards({ ...e, phase: 2 })).toBe(false);
    expect(learnsPlayerCards({ ...e, phase: 0 })).toBe(false);
    // 打出一張攻擊牌，回合結束後牠這一招就是照抄的
    const p = cs.player;
    const card = inst('sanjo', 900);
    p.hand = [card];
    expect(playCard(cs, card.uid, e.uid)).toBe(true);
    e.moveIndex = -1;
    endTurn(cs);
    expect(e.move.learned?.map((x) => x.cardId)).toContain('sanjo');
    // 抄牌的招另外附「亂」：輪流接偷牌、封攻擊、塞牌、封技能
    const kinds = new Set<string>();
    for (let t = 0; t < 4; t++) {
      for (const f of e.move.effects) kinds.add(f.kind);
      e.turnCount += 1;
      const hand = cs.player.hand[0];
      if (hand) playCard(cs, hand.uid, e.uid);
      endTurn(cs);
    }
    expect([...kinds].some((k) => k === 'stealCard' || k === 'sealType' || k === 'giveCard')).toBe(true);
  });

  it('第三關前兩形態仍有看穿（關數給的）；其他關的魔源形態不會讓別的機制漏進去', () => {
    // 第三關：形態一、二本來就有狡猾
    const cs = start();
    expect(cunningActive(cs)).toBe(true);
    // 第一關或第二關的一般魔物不受魔源資料影響
    expect(cunningActive(start('rats2', { act: 1 }))).toBe(false);
    expect(cunningActive(start('rats2', { act: 2 }))).toBe(false);
    expect(cunningActive(start('rats2', false))).toBe(false);
  });
});

describe('魔源：第二形態偷牌封牌、換形態還牌', () => {
  it('phase2StealsAndSeals：千手攫牌偷牌、封印封攻擊與技能、塞壞牌', () => {
    const cs = start();
    const e = toForm(cs, 2);
    const def = enemyById[SOURCE]!.phases![0]!;
    const kinds = new Set(def.moves.flatMap((m) => m.effects.map((f) => f.kind)));
    for (const k of ['stealCard', 'sealType', 'giveCard']) expect(kinds.has(k as 'stealCard'), k).toBe(true);
    const seals = def.moves.flatMap((m) => m.effects).filter((f) => f.kind === 'sealType').map((f) => (f as { type: string }).type).sort();
    expect(seals).toEqual(['attack', 'skill']);
    // 真的偷到：第一招是千手攫牌（換形態後從表上第一招開始）
    e.move = def.moves[0]!;
    e.moveIndex = 0;
    endTurn(cs);
    const stolen = (e.stolenCards?.length ?? 0) + (e.stealPending?.reduce((s, x) => s + x.n, 0) ?? 0);
    expect(stolen).toBeGreaterThan(0);
  });

  it('phaseChangeReturnsStolen：偷來的牌在換形態時一次還回來', () => {
    const cs = start();
    const e = toForm(cs, 2);
    const card = inst('sanjo', 777);
    (e.stolenCards ??= []).push({ seat: 0, card });
    cs.player.hand = [];
    breakBar(cs, e);   // 第二形態打完 → 第三形態
    expect(e.phase).toBe(2);
    expect(e.stolenCards).toBeUndefined();
    expect([...cs.player.hand, ...cs.player.discardPile].some((c) => c.uid === 777)).toBe(true);
  });
});

describe('魔源：第三形態面具輪換與召喚', () => {
  it('phase3RotatesMasksAndSummonsMax2：三張面具照表輪換，每三回合召一隻（同種最多 2 隻）', () => {
    const cs = start();
    const e = toForm(cs, 3);
    expect(e.phase).toBe(2);
    const labels: string[] = [];
    const bats = (): number => cs.enemies.filter((x) => x.enemyId === 'hell_medicine_bat' && !x.dead).length;
    const counts: number[] = [];
    e.invulnIn = 0;
    // 調息之後第一招；之後每一輪看頭上預告的招，連續 12 輪
    for (let i = 0; i < 12; i++) {
      labels.push(e.move.label);
      endTurn(cs);
      counts.push(bats());
      // 把小怪壓住不死（本測試只看輪換與上限，不看打小怪）
      if (cs.phase !== 'player') break;
    }
    expect(labels.slice(0, 6)).toEqual(['怒面', '哭面', '笑面', '怒面', '哭面', '笑面']);
    expect(Math.max(...counts)).toBeLessThanOrEqual(2);
    expect(Math.max(...counts)).toBe(2);
    // 召喚只發生在笑面那一回合：前兩回合沒有小怪
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBe(1);
  });

  it('千面不擲骰：同一個種子、同一串操作，輪換結果與 rng 狀態一致', () => {
    const run = (): { labels: string[]; rng: string } => {
      const cs = start(SOURCE, { act: 3 }, 'same');
      const e = toForm(cs, 3);
      const labels: string[] = [];
      for (let i = 0; i < 4; i++) { labels.push(e.move.label); endTurn(cs); }
      return { labels, rng: JSON.stringify(cs.rng.state) };
    };
    expect(run()).toEqual(run());
  });
});

describe('地獄的閘：嘲諷與暴怒跟著狡猾機制', () => {
  it('第一、二關即使資料帶嘲諷也不生效（過 cunningActive 這道閘）', () => {
    for (const act of [1, 2] as const) {
      const cs = start('hell_shell_kappa', { act });
      expect(cunningActive(cs)).toBe(false);
      expect(tauntingEnemy(cs)).toBeUndefined();
    }
    expect(tauntingEnemy(start('hell_shell_kappa', { act: 3 }))?.enemyId).toBe('hell_shell_kappa');
    expect(tauntingEnemy(start('hell_shell_kappa', false))).toBeUndefined();
  });
});

describe('通關與連線倍率', () => {
  it('coopScale：魔源的雙人血量倍率照師父起算', () => {
    expect(COOP_HP_BY_ENCOUNTER[SOURCE]).toEqual(COOP_HP_BY_ENCOUNTER['tower_master']);
  });

  it('runWinsAfterSource：地獄第三關打倒魔源＝通關（跟打倒師父同一條判準：最後一關的塔主）', () => {
    const run = newRun('src-run', 6);
    advanceAct(run); advanceAct(run);
    expect(run.act).toBe(3);
    const boss = nodesOnFloor(run.map, 15)[0]!;
    expect(boss.encounterId).toBe(SOURCE);
    run.currentNode = boss.id;
    const cs = beginCombat(run);
    expect(cs.hell?.act).toBe(3);
    expect(cs.hell?.miasmaLeft).toBe(SOURCE_MIASMA_TURNS);
    const e = cs.enemies[0]!;
    for (let i = 0; i < 4; i++) { e.invulnIn = 0; breakBar(cs, e); }
    expect(cs.phase).toBe('won');
    const r = finishCombat(run, cs);
    expect(r?.kind).toBe('塔主');
    expect(run.status).toBe('won');
  });

  it('難度 5 打倒師父照舊通關（一般難度的尾王沒變）', () => {
    const run = newRun('tm-run', 5);
    advanceAct(run); advanceAct(run);
    const boss = nodesOnFloor(run.map, 15)[0]!;
    expect(boss.encounterId).toBe('tower_master');
    run.currentNode = boss.id;
    const cs = beginCombat(run);
    expect(cs.hell).toBeUndefined();
    const e = cs.enemies[0]!;
    for (let i = 0; i < 3; i++) { e.invulnIn = 0; breakBar(cs, e); }
    expect(cs.phase).toBe('won');
    finishCombat(run, cs);
    expect(run.status).toBe('won');
  });
});
