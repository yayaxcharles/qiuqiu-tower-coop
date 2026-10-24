import { describe, expect, it } from 'vitest';
import { cardById } from '../../src/content/cards';
import { seenAttackDef, seenNeedsNote, seeThroughAmount } from '../../src/engine/hell';
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

  it('分身術第 1～3 次：印「基礎＋成長」的總和減半，跟引擎一致', () => {
    const def = cardById['bunshin']!;
    for (let plays = 0; plays < 3; plays++) {
      const actual = seeThroughAmount(seenCs, 'attack', 3 + 3 * plays);
      const face = describeCard(seenAttackDef(def, plays), false, 0);
      expect(face.startsWith(`造成 ${actual} 點傷害，`)).toBe(true);
    }
    expect(seeThroughAmount(seenCs, 'attack', 3 + 3 * 1)).toBe(3);
    expect(seeThroughAmount(seenCs, 'attack', 3 + 3 * 2)).toBe(4);
  });

  it('算式型攻擊（封封平斬）被看穿才補句；一般攻擊、技能不補', () => {
    const ping = cardById['fengfeng_pingzhan']!;
    expect(seenNeedsNote(ping, false)).toBe(true);
    expect(seenNeedsNote(ping, true)).toBe(true);
    expect(seenNeedsNote(cardById['sanjo']!, false)).toBe(false);
    expect(seenNeedsNote(cardById['bunshin']!, false)).toBe(false);
    expect(seenNeedsNote(cardById['zhuangsi']!, false)).toBe(false);
  });

  it('不動牌表、不動技能牌', () => {
    seenAttackDef(cardById['sanjo']!);
    expect(describeCard(cardById['sanjo']!, false)).toBe('造成 6 點傷害。');
    const skill = cardById['zhuangsi']!;
    expect(seenAttackDef(skill)).toBe(skill);
  });
});
