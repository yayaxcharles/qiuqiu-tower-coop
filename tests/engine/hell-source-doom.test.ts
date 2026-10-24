import { describe, expect, it } from 'vitest';
import { STARTER_DECK } from '../../src/content/cards';
import { enemyById } from '../../src/content/enemies';
import { damageEnemy } from '../../src/engine/actions';
import { endTurn, startCombat } from '../../src/engine/combat';
import { miasmaTick } from '../../src/engine/hell';
import { previewEnemyHits } from '../../src/engine/intentpreview';
import { Rng, seedFromString } from '../../src/engine/rng';
import { addStatus, getStatus } from '../../src/engine/statuses';
import type { CombatState, EnemyCombat } from '../../src/engine/types';
import { inst } from '../helpers';

/** 魔源換形態打散增益（dispel）＋真身九尾滅世倒數（doom）。數值不寫死，照資料定義斷言 */
const SOURCE = 'hell_source';
const def = enemyById[SOURCE]!;
const DOOM = def.phases![2]!.doom!;

function start(encounterId = SOURCE, hell: false | { act: 1 | 2 | 3 } = { act: 3 }): CombatState {
  return startCombat({
    hp: 9999, maxHp: 9999, deck: STARTER_DECK.map((id, i) => inst(id, i + 1)), relics: [], potions: [], encounterId,
    rng: new Rng(seedFromString('doom')), ...(hell ? { hell } : {}),
  });
}

function breakBar(cs: CombatState, e: EnemyCombat): void {
  e.block = 0;
  damageEnemy(cs, e, 99999, { direct: true, by: cs.player });
  e.invulnIn = 0;
}

/** 打到第 n 形態（1～4）；第四形態＝`phase` 3 */
function toForm(cs: CombatState, n: number): EnemyCombat {
  const e = cs.enemies.find((x) => x.enemyId === SOURCE)!;
  while (e.phase < n - 1) breakBar(cs, e);
  return e;
}

const buffs = (cs: CombatState): void => {
  const p = cs.player;
  addStatus(p, '爪力', 5); addStatus(p, '貓步', 4); addStatus(p, '反彈', 1); addStatus(p, '隱身', 3);
  addStatus(p, '炸毛', 3); addStatus(p, '中毒', 2);
};

describe('魔源換形態：打散玩家增益', () => {
  it('資料欄位：二、三、四形態都有 dispel，一形態本體沒有', () => {
    expect(def.phases!.map((p) => p.dispel)).toEqual([0.5, 0.5, 0.5]);
  });

  it('換形態：增益層數減半（無條件捨去）、減益與護甲不動、寫一行戰報', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    buffs(cs);
    cs.player.block = 7;
    const before = cs.log.length;
    breakBar(cs, e);
    const p = cs.player;
    expect(getStatus(p, '爪力')).toBe(2);   // 5 → 2（奇數捨去）
    expect(getStatus(p, '貓步')).toBe(2);
    expect(getStatus(p, '反彈')).toBe(0);   // 1 → 0
    expect(getStatus(p, '隱身')).toBe(1);   // 3 → 1
    expect(getStatus(p, '炸毛')).toBe(3);   // 減益不受影響
    expect(getStatus(p, '中毒')).toBe(2);
    expect(p.block).toBe(7);
    expect(cs.log.slice(before).filter((l) => l.includes('封印反噬'))).toHaveLength(1);
  });

  it('每一次換形態都減半（一→二→三→四）', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    addStatus(cs.player, '爪力', 16);
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) { breakBar(cs, e); seen.push(getStatus(cs.player, '爪力')); }
    expect(seen).toEqual([8, 4, 2]);
  });

  it('連線兩位：每位各自減半', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    // 手動補一位同伴（只要有 statuses 的玩家物件就夠測這條）
    const mate = { ...cs.player, seat: 1, statuses: { 爪力: 9 } } as unknown as CombatState['player'];
    cs.players.push(mate);
    addStatus(cs.player, '爪力', 6);
    breakBar(cs, e);
    expect(getStatus(cs.player, '爪力')).toBe(3);
    expect(getStatus(mate, '爪力')).toBe(4);
  });

  it('身上沒增益就不寫戰報', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    addStatus(cs.player, '炸毛', 2);
    const before = cs.log.length;
    breakBar(cs, e);
    expect(cs.log.slice(before).some((l) => l.includes('封印反噬'))).toBe(false);
  });

  it('難度 1～5（沒有 cs.hell）：換形態不動玩家的任何狀態，倒數也不開', () => {
    const cs = start(SOURCE, false);
    expect(cs.hell).toBeUndefined();
    const e = cs.enemies[0]!;
    buffs(cs);
    for (let i = 0; i < 3; i++) breakBar(cs, e);
    expect(cs.player.statuses).toMatchObject({ 爪力: 5, 貓步: 4, 反彈: 1, 隱身: 3, 炸毛: 3, 中毒: 2 });
    expect(cs.hell).toBeUndefined();
    miasmaTick(cs);
    expect(cs.hell).toBeUndefined();
  });
});

describe('魔源真身：九尾滅世倒數', () => {
  it('資料欄位：只有第四形態有，倒數 turns 輪、招式是一次攻擊', () => {
    expect(def.phases!.map((p) => p.doom !== undefined)).toEqual([false, false, true]);
    expect(DOOM.move.label).toBe('九尾滅世');
    expect(DOOM.move.intent).toBe('attack');
    expect(DOOM.turns).toBeGreaterThanOrEqual(5);
  });

  it('只在真身開：前三個形態沒有倒數，進第四形態才開成 turns', () => {
    const cs = start();
    expect(cs.hell?.doom).toBeUndefined();
    const e = toForm(cs, 3);
    expect(cs.hell?.doom).toBeUndefined();
    miasmaTick(cs);
    expect(cs.hell?.doom).toBeUndefined();
    breakBar(cs, e);
    expect(e.phase).toBe(3);
    expect(cs.hell?.doom).toBe(DOOM.turns);
  });

  it('每輪結束減 1；沒到 0 之前魔源的下一動不被換掉', () => {
    const cs = start();
    const e = toForm(cs, 4);
    const move = e.move;
    for (let i = 1; i < DOOM.turns; i++) {
      miasmaTick(cs);
      expect(cs.hell?.doom).toBe(DOOM.turns - i);
      expect(e.move).toBe(move);
    }
  });

  it('歸零那一輪：下一動換成九尾滅世，意圖照實顯示傷害（含爪力）、寫戰報', () => {
    const cs = start();
    const e = toForm(cs, 4);
    for (let i = 1; i < DOOM.turns; i++) miasmaTick(cs);
    const before = cs.log.length;
    miasmaTick(cs);
    expect(cs.hell?.doom).toBe(0);
    expect(e.move).toBe(DOOM.move);
    expect(cs.log.slice(before).some((l) => l.includes('蓄滿了力'))).toBe(true);
    const base = DOOM.move.effects.find((f) => f.kind === 'damage') as { amount: number };
    const hit = previewEnemyHits(e, e.move.effects, cs.player)[0]!;
    expect(hit.dmg).toBe(base.amount + getStatus(e, '爪力'));
  });

  it('真的放出去：玩家掉的血至少是九尾滅世的傷害', () => {
    const cs = start();
    const e = toForm(cs, 4);
    e.invulnIn = 0;
    for (let i = 0; i < DOOM.turns; i++) miasmaTick(cs);
    expect(e.move).toBe(DOOM.move);
    const base = (DOOM.move.effects.find((f) => f.kind === 'damage') as { amount: number }).amount;
    const hp0 = cs.player.hp;
    cs.player.block = 0;
    endTurn(cs);
    expect(hp0 - cs.player.hp).toBeGreaterThanOrEqual(base);
  });

  it('放完重新起算：下一輪回到 turns-1，再數 turns 輪又一次滅世', () => {
    const cs = start();
    const e = toForm(cs, 4);
    for (let i = 0; i < DOOM.turns; i++) miasmaTick(cs);
    expect(cs.hell?.doom).toBe(0);
    // 模擬放完後魔源又排了別招
    e.move = def.phases![2]!.moves[0]!;
    miasmaTick(cs);
    expect(cs.hell?.doom).toBe(DOOM.turns - 1);
    expect(e.move).toBe(def.phases![2]!.moves[0]);
    for (let i = 1; i < DOOM.turns; i++) miasmaTick(cs);
    expect(cs.hell?.doom).toBe(0);
    expect(e.move).toBe(DOOM.move);
  });

  it('魔源倒了就不再數', () => {
    const cs = start();
    const e = toForm(cs, 4);
    breakBar(cs, e);
    expect(e.dead).toBe(true);
    const d = cs.hell?.doom;
    miasmaTick(cs);
    expect(cs.hell?.doom).toBe(d);
  });
});
