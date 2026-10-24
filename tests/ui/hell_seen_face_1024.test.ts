import { describe, expect, it } from 'vitest';
import { cardById } from '../../src/content/cards';
import { seenAttackDef, seeThroughAmount } from '../../src/engine/hell';
import type { CombatState } from '../../src/engine/types';
import { describeCard } from '../../src/ui/cardtext';

/** 上線前修正 3（2026-10-24）：看穿攻擊時，攻擊牌的牌面傷害跟實際一樣（照 seeThroughAmount 取整減半，最少 1） */
describe('看穿（攻擊）牌面', () => {
  const seenCs = { hell: { act: 3, seeThrough: 'attack' } } as unknown as CombatState;

  it('三條（6 點）→ 3、升級 9 → 4（捨去）；跟 seeThroughAmount 一致', () => {
    const def = cardById['sanjo']!;
    expect(describeCard(def, false)).toBe('造成 6 點傷害。');
    expect(describeCard(seenAttackDef(def), false)).toBe(`造成 ${seeThroughAmount(seenCs, 'attack', 6)} 點傷害。`);
    expect(describeCard(seenAttackDef(def), false)).toBe('造成 3 點傷害。');
    expect(describeCard(seenAttackDef(def), true)).toBe('造成 4 點傷害。');
    expect(seeThroughAmount(seenCs, 'attack', 9)).toBe(4);
  });

  it('全體攻擊（9 → 4）、最少 1', () => {
    expect(describeCard(seenAttackDef(cardById['susu']!), false)).toBe('對全體魔物造成 4 點傷害。');
    const tiny = { ...cardById['sanjo']!, effects: [{ kind: 'damage' as const, amount: 1 }] };
    expect(describeCard(seenAttackDef(tiny), false)).toBe('造成 1 點傷害。');
  });

  it('不動牌表、不動技能牌', () => {
    seenAttackDef(cardById['sanjo']!);
    expect(describeCard(cardById['sanjo']!, false)).toBe('造成 6 點傷害。');
    const skill = cardById['zhuangsi']!;
    expect(seenAttackDef(skill)).toBe(skill);
  });
});
