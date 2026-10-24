import { describe, expect, it } from 'vitest';
import { STARTER_DECK } from '../../src/content/cards';
import { playCard, startCombat } from '../../src/engine/combat';
import { Rng, seedFromString } from '../../src/engine/rng';
import { addStatus, getStatus } from '../../src/engine/statuses';
import type { CombatState } from '../../src/engine/types';
import { inst } from '../helpers';

/*
 * 審查「看穿技能漏減」（2026-10-24）：靠你一下、借勢、絕學·催噎三張技能牌，被看穿技能時給的量也要減半；
 * 沒被看穿（或一般難度）原值不變。`transferDebuffs` 刻意不減（把自己的減益轉走，減半＝白白少了減益）。
 */

function start(seeThrough: 'skill' | null, hell = true): CombatState {
  const cs = startCombat({
    hp: 9999, maxHp: 9999, deck: STARTER_DECK.map((id, i) => inst(id, i + 1)), relics: [], potions: [], encounterId: 'rats2',
    rng: new Rng(seedFromString('seeskill')), ...(hell ? { hell: { act: 3 as const } } : {}),
  });
  if (seeThrough && cs.hell) cs.hell.seeThrough = seeThrough;
  return cs;
}
const hand = (cs: CombatState, id: string): number => {
  cs.player.hand = [inst(id, 900)];
  cs.player.energy = 3;
  return 900;
};

describe('看穿技能：漏減的三種效果', () => {
  it('blockFromAllyBlock（靠你一下）：給的總量減半；沒看穿原值', () => {
    for (const [seen, want] of [['skill', 5], [null, 10]] as const) {   // 5＋同伴（單人＝自己）蜷縮 10 的一半 5＝10；看穿減成 5
      const cs = start(seen);
      cs.player.block = 10;
      expect(playCard(cs, hand(cs, 'kaoniyixia'))).toBe(true);
      expect(cs.player.block - 10, String(seen)).toBe(want);
    }
  });

  it('blockFromThorns（借勢）：放進去的蜷縮減半，反彈本身不減；沒看穿原值', () => {
    for (const [seen, want] of [['skill', 3], [null, 7]] as const) {
      const cs = start(seen);
      addStatus(cs.player, '反彈', 7);
      expect(playCard(cs, hand(cs, 'dangdang_jieshi'))).toBe(true);
      expect(cs.player.block, String(seen)).toBe(want);
      expect(getStatus(cs.player, '反彈')).toBe(7);
    }
  });

  it('doubleStatus（絕學·催噎）：加上去的層數減半；沒看穿原值（翻倍）', () => {
    for (const [seen, want] of [['skill', 9], [null, 12]] as const) {
      const cs = start(seen);
      const e = cs.enemies[0]!;
      addStatus(e, '中毒', 6);
      expect(playCard(cs, hand(cs, 'cuiye'), e.uid)).toBe(true);
      expect(getStatus(e, '中毒'), String(seen)).toBe(want);
    }
  });

  it('一般難度（沒有 cs.hell）：三張都是原值', () => {
    const cs = start(null, false);
    cs.player.block = 10;
    playCard(cs, hand(cs, 'kaoniyixia'));
    expect(cs.player.block).toBe(20);
  });
});
