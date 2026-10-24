import { beforeEach, describe, expect, it } from 'vitest';
import { cardById } from '../../src/content/cards';
import { anyBlessingPending, blessingPending, rollBlessings, startAtkPending, takeBlessing, takeStartAttack } from '../../src/engine/blessing';
import { HEROES, pickable } from '../../src/engine/hero';
import { newCoopRun, newRun } from '../../src/engine/run';
import { me } from '../../src/engine/runplayer';
import { checkRun, loadRun, saveRun, setStore } from '../../src/engine/save';
import { smartBless } from '../../src/engine/smartbot';
import { applyRunAction, canApplyRun } from '../../src/net/runaction';

/** 地獄開局先從三張一般攻擊牌挑一張（2026-10-24 使用者試玩回饋）：祝福選完才輪到、可以跳過、各座位各挑各的 */
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}
beforeEach(() => { setStore(memStore()); });

describe('地獄開局三選一攻擊牌', () => {
  for (const hero of HEROES) {
    it(`${hero}：三張都是自己能拿的 common 攻擊牌、不重複`, () => {
      for (let i = 0; i < 40; i++) {
        const run = newRun(`atk-${hero}-${i}`, 6, hero);
        rollBlessings(run);
        const atk = me(run).bless!.atk!;
        expect(atk.length).toBe(3);
        expect(new Set(atk).size).toBe(3);
        for (const id of atk) {
          const c = cardById[id]!;
          expect(c.type).toBe('attack');
          expect(c.rarity).toBe('common');
          expect(pickable(c, hero, 1)).toBe(true);
        }
      }
    });
  }

  it('難度 1～5 沒有這一步，也不動 run.rng', () => {
    for (const d of [1, 3, 5]) {
      const run = newRun('atk-lowdiff', d, 'ninja');
      const rng = run.rng;
      rollBlessings(run);
      expect(me(run).bless!.atk).toBeUndefined();
      expect(run.rng).toBe(rng);
    }
  });

  it('祝福選完才輪到；挑了進牌組、完成後不再 pending', () => {
    const run = newRun('atk-flow', 6, 'ninja');
    rollBlessings(run);
    expect(startAtkPending(run, 0)).toBe(false);   // 祝福還沒選
    expect(takeStartAttack(run, 0, me(run).bless!.atk![0]!)).toBe(false);
    expect(takeBlessing(run, 0, 0)).toBe(true);
    expect(blessingPending(run, 0)).toBe(true);    // 還要挑攻擊牌
    expect(anyBlessingPending(run)).toBe(true);
    const before = me(run).deck.length;
    const pick = me(run).bless!.atk![1]!;
    expect(takeStartAttack(run, 0, 'not-a-card')).toBe(false);
    expect(takeStartAttack(run, 0, pick)).toBe(true);
    expect(me(run).deck.length).toBe(before + 1);
    expect(me(run).deck.some((c) => c.cardId === pick)).toBe(true);
    expect(anyBlessingPending(run)).toBe(false);
    expect(takeStartAttack(run, 0, pick)).toBe(false);   // 只能挑一次
  });

  it('跳過不加牌，也算完成', () => {
    const run = newRun('atk-skip', 6, 'feifei');
    rollBlessings(run);
    takeBlessing(run, 0, 0);
    const before = me(run).deck.length;
    expect(takeStartAttack(run, 0, '')).toBe(true);
    expect(me(run).deck.length).toBe(before);
    expect(anyBlessingPending(run)).toBe(false);
  });

  it('連線：兩座位各挑各的，經由整局動作，順序不影響結果', () => {
    const mk = () => { const r = newCoopRun('atk-coop', 6, 'dangdang', 'fengfeng'); rollBlessings(r); return r; };
    const a = mk(); const b = mk();
    const ctxA = { run: a }; const ctxB = { run: b };
    for (const ctx of [ctxA, ctxB]) for (const s of [0, 1]) expect(applyRunAction(ctx, { t: 'bless', seat: s, i: 0 })).toBe(true);
    const pick0 = a.players[0]!.bless!.atk![0]!;
    const pick1 = a.players[1]!.bless!.atk![2]!;
    // 別人那份的牌不能挑
    const only1 = a.players[1]!.bless!.atk!.find((id) => !a.players[0]!.bless!.atk!.includes(id));
    if (only1) expect(canApplyRun(ctxA, { t: 'atk', seat: 0, c: only1 })).toBe(false);
    expect(canApplyRun(ctxA, { t: 'atk', seat: 0, c: pick0 })).toBe(true);
    applyRunAction(ctxA, { t: 'atk', seat: 0, c: pick0 }); applyRunAction(ctxA, { t: 'atk', seat: 1, c: pick1 });
    applyRunAction(ctxB, { t: 'atk', seat: 1, c: pick1 }); applyRunAction(ctxB, { t: 'atk', seat: 0, c: pick0 });
    for (const r of [a, b]) {
      expect(r.players[0]!.deck.some((c) => c.cardId === pick0)).toBe(true);
      expect(r.players[1]!.deck.some((c) => c.cardId === pick1)).toBe(true);
      expect(anyBlessingPending(r)).toBe(false);
    }
    expect(a.players[0]!.deck.length).toBe(b.players[0]!.deck.length);
    expect(a.players[1]!.deck.length).toBe(b.players[1]!.deck.length);
    expect(canApplyRun(ctxA, { t: 'atk', seat: 0, c: pick0 })).toBe(false);   // 挑過了
  });

  it('存檔來回：offer 與 atk 都留著，壞掉的 atk 只丟那一步', () => {
    const run = newRun('atk-save', 6, 'ninja');
    rollBlessings(run);
    const atk = me(run).bless!.atk!.slice();
    saveRun(run);
    const back = loadRun()!;
    expect(me(back).bless!.atk).toEqual(atk);
    const bad = JSON.parse(JSON.stringify(run));
    bad.players[0].bless.atk = ['no_such_card'];
    const fixed = checkRun(bad);
    expect(fixed?.players[0]?.bless?.atk).toBeUndefined();
  });

  it('機器人會挑（難度 6 牌組多一張攻擊牌；難度 1 不變）', () => {
    const run = newRun('atk-bot', 6, 'ninja');
    const before = me(run).deck.length;
    expect(smartBless(run)).toBeTruthy();
    expect(me(run).deck.length).toBeGreaterThan(before);   // 至少多了攻擊牌那一張
    expect(anyBlessingPending(run)).toBe(false);
  });
});
