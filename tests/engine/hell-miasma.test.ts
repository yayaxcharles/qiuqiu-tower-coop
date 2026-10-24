import { describe, expect, it } from 'vitest';
import { STARTER_DECK } from '../../src/content/cards';
import { endTurn, startCombat } from '../../src/engine/combat';
import { hellDrawPenalty, MIASMA_TURNS, miasmaTick } from '../../src/engine/hell';
import { Rng, seedFromString } from '../../src/engine/rng';
import { advanceAct, beginCombat, newRun } from '../../src/engine/run';
import { addStatus, getStatus } from '../../src/engine/statuses';
import type { CombatState } from '../../src/engine/types';
import { combatFingerprint } from '../../src/net/hash';
import { inst } from '../helpers';

function start(encounterId: string, hell?: { act: 1 | 2 | 3 }, seed = 's'): CombatState {
  const cs = startCombat({
    hp: 9999, maxHp: 9999, deck: STARTER_DECK.map((id, i) => inst(id, i + 1)), relics: [], potions: [], encounterId,
    rng: new Rng(seedFromString(seed)), ...(hell ? { hell } : {}),
  });
  return cs;
}

// 迴圈測試用 rats2（普通的鼠，不會自爆、不會逃）：地獄魔物各有自己的把戲（引信小鬼會炸掉自己），會讓戰鬥提前結束
describe('地獄第一關：紫霧倒數', () => {
  it('countdownByPool：一般戰、大魔物、關主的起始倒數＝MIASMA_TURNS', () => {
    expect(start('hell_fuse_imp', { act: 1 }).hell?.miasmaLeft).toBe(MIASMA_TURNS.normal);
    expect(start('hell_loot_weasel', { act: 1 }).hell?.miasmaLeft).toBe(MIASMA_TURNS.normal);
    expect(start('hell_fire_wheel', { act: 1 }).hell?.miasmaLeft).toBe(MIASMA_TURNS.normal);
    expect(start('hell_clock_oni', { act: 1 }).hell?.miasmaLeft).toBe(MIASMA_TURNS.elite);
    expect(start('hell_hourglass_shogun', { act: 1 }).hell?.miasmaLeft).toBe(MIASMA_TURNS.boss);
    expect(MIASMA_TURNS).toEqual({ normal: 6, elite: 8, boss: 10 });
  });

  it('非地獄遭遇（事件對手）在地獄第一關也有紫霧，算一般戰', () => {
    expect(start('rats2', { act: 1 }).hell?.miasmaLeft).toBe(MIASMA_TURNS.normal);
  });

  it('act2NoMiasma：第二、三關有 hell 狀態但沒有紫霧，抽牌不減', () => {
    for (const act of [2, 3] as const) {
      const cs = start('hell_fuse_imp', { act });
      expect(cs.hell).toEqual({ act });
      expect(cs.hell?.miasmaLeft).toBeUndefined();
      expect(hellDrawPenalty(cs)).toBe(0);
      const before = cs.rng.state.a;
      miasmaTick(cs);
      expect(cs.rng.state.a).toBe(before);
      expect(cs.enemies.every((e) => getStatus(e, '爪力') === 0)).toBe(true);
    }
  });

  it('noHellOptionLeavesStateAlone：一般難度 cs.hell 是 undefined，第一回合照抽 5 張，結果與不帶地獄選項逐位元相同', () => {
    const a = start('rats2');
    expect(a.hell).toBeUndefined();
    expect(a.player.hand.length).toBe(5);
    // 不帶 hell 的一局：endTurn 之後仍是 5 張、指紋不含地獄欄位
    endTurn(a);
    expect(a.hell).toBeUndefined();
    expect(a.player.hand.length).toBe(5);
    const b = start('rats2');
    endTurn(b);
    expect(combatFingerprint(a)).toBe(combatFingerprint(b));
    expect(hellDrawPenalty(a)).toBe(0);
  });

  it('倒數每輪減 1，歸零那一輪寫一行戰報、之後不再重複寫', () => {
    const cs = start('hell_fuse_imp', { act: 1 });
    const n = MIASMA_TURNS.normal;
    for (let i = 1; i < n; i++) { miasmaTick(cs); expect(cs.hell?.miasmaLeft).toBe(n - i); }
    const logs = cs.log.length;
    miasmaTick(cs);
    expect(cs.hell?.miasmaLeft).toBe(0);
    expect(cs.log.length).toBeGreaterThan(logs);
    expect(cs.log.filter((l) => l.includes('紫霧')).length).toBe(1);
  });

  it('afterZeroEnemiesGain2ClawEachRound：歸零之後每一輪魔物 +2 爪力，累加', () => {
    const cs = start('hell_fuse_pair', { act: 1 });
    cs.hell!.miasmaLeft = 1;
    const base = cs.enemies.map((e) => getStatus(e, '爪力'));
    miasmaTick(cs);                       // 歸零那一輪：還沒加
    expect(cs.hell?.miasmaLeft).toBe(0);
    cs.enemies.forEach((e, i) => expect(getStatus(e, '爪力')).toBe(base[i]));
    miasmaTick(cs);
    cs.enemies.forEach((e, i) => expect(getStatus(e, '爪力')).toBe(base[i]! + 2));
    miasmaTick(cs);
    cs.enemies.forEach((e, i) => expect(getStatus(e, '爪力')).toBe(base[i]! + 4));
  });

  it('倒下的魔物不加爪力；後來才進場的魔物從下一輪起加', () => {
    const cs = start('hell_fuse_pair', { act: 1 });
    cs.hell!.miasmaLeft = 0;
    cs.enemies[0]!.dead = true;
    const dead0 = getStatus(cs.enemies[0]!, '爪力');
    const alive0 = getStatus(cs.enemies[1]!, '爪力');
    miasmaTick(cs);
    expect(getStatus(cs.enemies[0]!, '爪力')).toBe(dead0);
    expect(getStatus(cs.enemies[1]!, '爪力')).toBe(alive0 + 2);
  });

  it('afterZeroDrawFour：歸零後每回合少抽 1 張（5 變 4），不累加', () => {
    const cs = start('rats2', { act: 1 });
    expect(cs.player.hand.length).toBe(5);
    cs.hell!.miasmaLeft = 1;
    endTurn(cs);                          // 這一輪結束倒數歸零 → 下回合抽 4
    expect(cs.hell?.miasmaLeft).toBe(0);
    expect(hellDrawPenalty(cs)).toBe(1);
    expect(cs.player.hand.length).toBe(4);
    endTurn(cs);
    expect(cs.player.hand.length).toBe(4);
    endTurn(cs);
    expect(cs.player.hand.length).toBe(4);
  });

  it('倒數沒到零之前照抽 5 張', () => {
    const cs = start('rats2', { act: 1 });
    endTurn(cs);
    expect(cs.hell!.miasmaLeft).toBe(MIASMA_TURNS.normal - 1);
    expect(cs.player.hand.length).toBe(5);
  });

  it('miasmaTicksOncePerRoundEvenWhenEnemyTurnSkipped：先手香跳過魔物回合也只減 1', () => {
    const cs = start('rats2', { act: 1 });
    cs.skipEnemies = true;
    endTurn(cs);
    expect(cs.hell!.miasmaLeft).toBe(MIASMA_TURNS.normal - 1);
    expect(cs.turn).toBe(2);
  });

  it('miasmaTicksOncePerRoundEvenWhenEnemyTurnSkipped：魔物全被定身也只減 1', () => {
    const cs = start('rats2', { act: 1 });
    for (const e of cs.enemies) addStatus(e, '定身', 1);
    endTurn(cs);
    expect(cs.hell!.miasmaLeft).toBe(MIASMA_TURNS.normal - 1);
  });

  it('連打三輪就是減三', () => {
    const cs = start('rats2', { act: 1 });
    endTurn(cs); endTurn(cs); endTurn(cs);
    expect(cs.hell!.miasmaLeft).toBe(MIASMA_TURNS.normal - 3);
  });

  it('連線指紋含紫霧倒數：兩邊倒數不同要抓得到', () => {
    const a = start('rats2', { act: 1 });
    const b = start('rats2', { act: 1 });
    expect(combatFingerprint(a)).toBe(combatFingerprint(b));
    b.hell!.miasmaLeft = 3;
    expect(combatFingerprint(a)).not.toBe(combatFingerprint(b));
  });

  it('beginCombat：難度 6 帶 hell（關數跟 run.act），難度 5 沒有', () => {
    const r6 = newRun('miasma-run', 6);
    expect(beginCombat(r6, 'hell_fuse_imp').hell).toEqual({ act: 1, miasmaLeft: MIASMA_TURNS.normal });
    advanceAct(r6);
    expect(beginCombat(r6, 'hell_paper_crane').hell).toEqual({ act: 2 });
    for (const d of [1, 3, 5]) {
      const r = newRun('miasma-run', d);
      const cs = beginCombat(r, 'rats2');
      expect(cs.hell, `d${d}`).toBeUndefined();
      expect(cs.player.hand.length, `d${d}`).toBe(5 + (cs.player.relics.includes('blue_headband') ? 2 : 0));
    }
  });
});
