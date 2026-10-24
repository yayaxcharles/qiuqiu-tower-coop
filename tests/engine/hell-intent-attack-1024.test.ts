import { describe, expect, it } from 'vitest';
import { hellEnemies } from '../../src/content/enemies-hell';

/**
 * 上線前修正 4（2026-10-24）：地獄魔物有傷害效果的招，意圖一律 `'attack'`——
 * 噹噹「見招拆招」（ifEnemyIntent）才會觸發、魔物出手才會做撲擊動作；牌子文字照效果組，召喚、偷、封等附加效果照樣會列。
 */
describe('地獄魔物：有傷害的招意圖都是 attack', () => {
  it('damage／selfDestruct／damageRandom／damageByPlayerStatus 的招沒有例外', () => {
    const DMG = ['damage', 'selfDestruct', 'damageRandom', 'damageByPlayerStatus'];
    const bad: string[] = [];
    for (const e of hellEnemies) {
      const all = [...e.moves, ...(e.phases ?? []).flatMap((p) => [...p.moves, ...(p.doom ? [p.doom.move] : [])])];
      for (const m of all) if (m.effects.some((f) => DMG.includes(f.kind)) && m.intent !== 'attack') bad.push(`${e.id}:${m.label}:${m.intent}`);
    }
    expect(bad).toEqual([]);
  });
});
