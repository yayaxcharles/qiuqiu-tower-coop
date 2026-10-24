import { describe, expect, it } from 'vitest';
import { cardById } from '../../src/content/cards';
import { Rng, seedFromString } from '../../src/engine/rng';
import { rollRewards } from '../../src/engine/rewards';
import { HEROES } from '../../src/engine/hero';

/** 地獄：戰後選牌四選一、至少兩張攻擊牌（2026-10-24 使用者試玩回饋）；難度 1～5 不傳 `hell`，抽法不變 */
const SEEDS = Array.from({ length: 60 }, (_, i) => `hell-cards-${i}`);
const roll = (seed: string, kind: '戰鬥' | '大魔物', o: { hell?: boolean; hero?: string; late?: boolean; extra?: number; players?: number }) =>
  rollRewards(new Rng(seedFromString(seed)), kind, [], 0, o.late ?? false,
    { hero: (o.hero ?? 'ninja') as never, extraChoices: o.extra ?? 0, players: o.players ?? 1, ...(o.hell ? { hell: true } : {}) });
const attacks = (cs: { id: string }[]): number => cs.filter((c) => cardById[c.id]?.type === 'attack').length;

describe('地獄：戰後選牌四選一、保底兩張攻擊', () => {
  for (const hero of HEROES) {
    it(`${hero}：一般戰與大魔物戰四張、至少兩張攻擊牌、不重複`, () => {
      for (const seed of SEEDS) {
        for (const late of [false, true]) {
          for (const kind of ['戰鬥', '大魔物'] as const) {
            const r = roll(seed, kind, { hell: true, hero, late });
            expect(r.cards.length, `${seed} ${kind} late=${late}`).toBe(4);
            expect(attacks(r.cards), `${seed} ${kind} late=${late}`).toBeGreaterThanOrEqual(2);
            expect(new Set(r.cards.map((c) => c.id)).size).toBe(4);
          }
        }
      }
    });
  }

  it('跟掌門印疊加：再多一張，仍保底兩張攻擊', () => {
    for (const seed of SEEDS) {
      const r = roll(seed, '戰鬥', { hell: true, extra: 1 });
      expect(r.cards.length).toBe(5);
      expect(attacks(r.cards)).toBeGreaterThanOrEqual(2);
    }
  });

  it('連線：兩人局也是四張、至少兩張攻擊', () => {
    for (const seed of SEEDS) {
      const r = roll(seed, '戰鬥', { hell: true, hero: 'dangdang', players: 2 });
      expect(r.cards.length).toBe(4);
      expect(attacks(r.cards)).toBeGreaterThanOrEqual(2);
    }
  });

  it('難度 1～5（不傳 hell）：一般戰三張、大魔物三張，跟改前一樣', () => {
    for (const seed of SEEDS) {
      expect(roll(seed, '戰鬥', {}).cards.length).toBe(3);
      expect(roll(seed, '大魔物', {}).cards.length).toBe(3);
      expect(roll(seed, '戰鬥', { late: true }).cards.length).toBe(3);
    }
  });
});
