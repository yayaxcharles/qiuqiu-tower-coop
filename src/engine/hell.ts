/**
 * 難度 6「地獄」的戰鬥內狀態與機制（設計：docs/superpowers/specs/2026-10-21-hell-difficulty-design.md）。
 *
 * **閘門**：一般難度（1～5）`cs.hell` 永遠是 undefined，這裡的函式一律先看它、沒有就直接回，
 * 不動狀態、不碰 `cs.rng`——所以難度 1～5 的每一局逐位元不變。
 * 機制只看**所在關數**（`act`），不看對手是不是地獄魔物（事件對手、問號格伏擊也照關數套）。
 */
import { encounterById } from '../content/enemies';
import { log } from './actions';
import { addStatus } from './statuses';
import type { CombatState } from './types';

export interface HellState {
  act: 1 | 2 | 3;
  miasmaLeft?: number;                 // 只有第一關（與魔源第一形態）有；0＝已歸零
  sealNext?: 'attack' | 'skill';       // Task 5
  sealed?: 'attack' | 'skill';         // Task 5
  lastPlays?: { attack: number; skill: number };  // Task 6
  seeThrough?: 'attack' | 'skill' | null;          // Task 6
}

/** 紫霧起始倒數（玩家回合數）：一般戰、大魔物、關主。量測再調 */
export const MIASMA_TURNS: Record<'normal' | 'elite' | 'boss', number> = { normal: 6, elite: 8, boss: 10 };

/** 紫霧歸零後，每一輪魔物各加的爪力 */
export const MIASMA_CLAW = 2;

/** 開戰時呼叫一次（`startCombat`，第一回合開始之前）：掛上地獄狀態，第一關再加紫霧倒數 */
export function initHell(cs: CombatState, act: 1 | 2 | 3): void {
  cs.hell = { act };
  if (act !== 1) return;
  const pool = encounterById[cs.encounterId]?.pool;
  cs.hell.miasmaLeft = MIASMA_TURNS[pool === '塔主' ? 'boss' : pool === '大魔物' ? 'elite' : 'normal'];
}

/**
 * 每一輪結束呼叫一次（`finishEnemyTurn`，換回玩家回合之前）。
 * 倒數還沒歸零就減 1，減到 0 的那一輪寫一行戰報；已經是 0 就讓每隻活著的魔物 +2 爪力（累加）。
 */
export function miasmaTick(cs: CombatState): void {
  const h = cs.hell;
  if (!h || h.miasmaLeft === undefined) return;
  if (h.miasmaLeft > 0) {
    h.miasmaLeft -= 1;
    if (h.miasmaLeft === 0) log(cs, '紫霧漫滿了！之後每一輪魔物全體爪力 +2，你每回合少抽 1 張牌');
    return;
  }
  for (const e of cs.enemies) if (!e.dead) addStatus(e, '爪力', MIASMA_CLAW);
}

/** 抽牌要少幾張：紫霧歸零回 1（固定、不累加），否則 0 */
export function hellDrawPenalty(cs: CombatState): number {
  return cs.hell?.miasmaLeft === 0 ? 1 : 0;
}
