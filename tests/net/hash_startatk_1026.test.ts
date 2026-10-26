import { describe, expect, it } from 'vitest';
import { rollBlessings, takeBlessing, takeStartAttack } from '../../src/engine/blessing';
import { newCoopRun, newRun } from '../../src/engine/run';
import { me } from '../../src/engine/runplayer';
import { runFingerprint } from '../../src/net/hash';

/** 連線局面雜湊要收錄地獄開局「挑攻擊牌」那一步（稽核 2026-10-26 第 7 條）：跳過與還沒挑，牌組一樣，雜湊不能一樣 */
describe('局面雜湊：開局攻擊牌', () => {
  it('有攻擊牌選項時：還沒挑、跳過、挑了，三種雜湊都不同', () => {
    const mk = () => { const r = newCoopRun('hash-atk', 6, 'ninja', 'ninja'); rollBlessings(r); takeBlessing(r, 0, 0); return r; };
    const pending = runFingerprint(mk());
    const skipped = mk(); expect(takeStartAttack(skipped, 0, '')).toBe(true);
    const picked = mk(); expect(takeStartAttack(picked, 0, me(picked).bless!.atk![0]!)).toBe(true);
    const hs = [pending, runFingerprint(skipped), runFingerprint(picked)];
    expect(new Set(hs).size).toBe(3);
  });

  it('沒有攻擊牌選項的局（難度 1～5）：雜湊字串跟改前一模一樣', () => {
    const run = newRun('hash-atk-lowdiff', 3, 'ninja');
    rollBlessings(run);
    expect(me(run).bless!.atk).toBeUndefined();
    expect(runFingerprint(run)).toBe('d93add7c');
    expect(takeBlessing(run, 0, 0)).toBe(true);
    expect(runFingerprint(run)).toBe('c856e1fd');
  });
});
