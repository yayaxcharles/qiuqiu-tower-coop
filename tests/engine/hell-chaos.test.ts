import { describe, expect, it } from 'vitest';
import { cardById, STARTER_DECK } from '../../src/content/cards';
import { enemyById } from '../../src/content/enemies';
import { hellEnemies } from '../../src/content/enemies-hell';
import { damageEnemy, runEnemyEffects } from '../../src/engine/actions';
import { canPlay, endTurn, startCombat } from '../../src/engine/combat';
import { HAND_LIMIT } from '../../src/engine/deck';
import { resolveStealPending, returnAllStolen, returnStolen, sealType, stealCards } from '../../src/engine/hell';
import { Rng, seedFromString } from '../../src/engine/rng';
import { advanceAct, beginCombat, finishCombat, newCoopRun, newRun } from '../../src/engine/run';
import { smartRun } from '../../src/engine/smartbot';
import { getStatus } from '../../src/engine/statuses';
import type { CardInstance, CombatState, EnemyCombat, EnemyEffect } from '../../src/engine/types';
import { combatFingerprint } from '../../src/net/hash';
import { inst } from '../helpers';

/** 一般難度或地獄第二關的單人戰；rats2 是普通的鼠（不偷牌、不封牌、不逃） */
function start(encounterId = 'rats2', hell: boolean | { act: 1 | 2 | 3 } = { act: 2 }, deck: string[] = [...STARTER_DECK], seed = 'chaos'): CombatState {
  return startCombat({
    hp: 9999, maxHp: 9999, deck: deck.map((id, i) => inst(id, i + 1)), relics: [], potions: [], encounterId,
    rng: new Rng(seedFromString(seed)), ...(hell ? { hell: hell === true ? { act: 2 as const } : hell } : {}),
  });
}

const steal = (n: number): EnemyEffect => ({ kind: 'stealCard', n });
const seal = (type: 'attack' | 'skill'): EnemyEffect => ({ kind: 'sealType', type });
const atk = (): string => 'sanjo';
const typeOf = (c: CardInstance): string => cardById[c.cardId]!.type;
const everywhere = (cs: CombatState, seat = 0): number[] => {
  const p = cs.players[seat]!;
  return [...p.hand, ...p.drawPile, ...p.discardPile, ...p.exhaustPile].map((c) => c.uid);
};

describe('地獄第二關：偷牌', () => {
  it('stealTakesFromTargetHand：從這一招瞄準那位的手牌隨機拿走 n 張，藏在魔物身上', () => {
    const cs = start();
    const p = cs.player;
    const e = cs.enemies[0]!;
    const before = p.hand.map((c) => c.uid);
    expect(before.length).toBe(5);
    runEnemyEffects(cs, e, [steal(2)], false, p);
    expect(p.hand.length).toBe(3);
    expect(e.stolenCards?.length).toBe(2);
    for (const s of e.stolenCards!) {
      expect(s.seat).toBe(0);
      expect(before).toContain(s.card.uid);
      expect(p.hand.some((c) => c.uid === s.card.uid)).toBe(false);
    }
    expect(e.stealPending).toBeUndefined();
    expect(cs.log.some((l) => l.includes('順走了你的'))).toBe(true);
  });

  it('stealOnEmptyHandNoop：手牌與牌堆全空時什麼都偷不到，也不留待偷', () => {
    const cs = start();
    const p = cs.player;
    const e = cs.enemies[0]!;
    p.hand = []; p.drawPile = []; p.discardPile = [];
    const rngBefore = JSON.stringify(cs.rng.state);
    stealCards(cs, e, p, 1);
    expect(e.stolenCards).toBeUndefined();
    expect(e.stealPending).toEqual([{ seat: 0, n: 1 }]);   // 先記著，等下一手牌
    resolveStealPending(cs, p);                              // 下一手還是空的：算了
    expect(e.stolenCards).toBeUndefined();
    expect(e.stealPending).toBeUndefined();
    expect(JSON.stringify(cs.rng.state)).toBe(rngBefore);   // 沒牌可拿就不擲骰
  });

  it('stealsFromNextHandAfterEnemyTurn：真實流程——魔物出手時手牌已經棄光，下一手牌抽好後少一張，牌藏在牠身上', () => {
    const cs = start('hell_pickpocket_monkey');
    const e = cs.enemies[0]!;
    expect(e.move.label).toBe('順走一張');
    const all = [...cs.player.hand, ...cs.player.drawPile].map((c) => c.uid).sort((a, b) => a - b);
    endTurn(cs);
    expect(e.stolenCards?.length).toBe(1);
    expect(cs.player.hand.length).toBe(4);                  // 5 張抽好，被順走 1 張
    expect(everywhere(cs).length).toBe(9);
    const stolen = e.stolenCards![0]!.card.uid;
    expect(everywhere(cs)).not.toContain(stolen);
    expect([...everywhere(cs), stolen].sort((a, b) => a - b)).toEqual(all);
    expect(e.stealPending).toBeUndefined();
  });

  it('保留在手上的牌也偷得到：出手當下手牌裡有東西就直接拿', () => {
    const cs = start();
    const p = cs.player;
    p.hand = [inst('sanjo', 901)];
    const e = cs.enemies[0]!;
    runEnemyEffects(cs, e, [steal(2)], false, p);
    expect(p.hand.length).toBe(0);
    expect(e.stolenCards!.map((s) => s.card.uid)).toEqual([901]);
    expect(e.stealPending).toEqual([{ seat: 0, n: 1 }]);   // 剩的一張等下一手牌
  });

  it('returnsOnDefeat：魔物被打倒，牌回到手牌，欄位清空', () => {
    const cs = start('rats2', { act: 2 }, [...STARTER_DECK], 'defeat');
    const p = cs.player;
    const e = cs.enemies[0]!;
    runEnemyEffects(cs, e, [steal(1)], false, p);
    const uid = e.stolenCards![0]!.card.uid;
    expect(p.hand.length).toBe(4);
    damageEnemy(cs, e, 9999, { direct: true, by: p });
    expect(e.dead).toBe(true);
    expect(e.stolenCards).toBeUndefined();
    expect(p.hand.length).toBe(5);
    expect(p.hand.some((c) => c.uid === uid)).toBe(true);
    expect(cs.log.some((l) => l.includes('回到你手上了'))).toBe(true);
  });

  it('returnsStolenOnEscapeSplitAndCombatEnd：逃走、分裂、散去、換形態、戰鬥結束，每一條出口都把牌還回去', () => {
    // 逃走
    {
      const cs = start('hell_fuse_pair', { act: 2 }, [...STARTER_DECK, ...STARTER_DECK], 'esc');
      const p = cs.player; const e = cs.enemies[0]!;
      runEnemyEffects(cs, e, [steal(1), { kind: 'escape' }], false, p);
      expect(e.escaped).toBe(true);
      expect(e.stolenCards).toBeUndefined();
      expect(everywhere(cs).length).toBe(20);
      expect(p.hand.length).toBe(5);
    }
    // 自爆（走擊倒路徑）
    {
      const cs = start('rats2', { act: 2 }, [...STARTER_DECK], 'boom');
      const p = cs.player; const e = cs.enemies[0]!;
      runEnemyEffects(cs, e, [steal(1), { kind: 'selfDestruct', amount: 1 }], false, p);
      expect(e.dead).toBe(true);
      expect(e.stolenCards).toBeUndefined();
      expect(p.hand.length).toBe(5);
    }
    // 分裂：血量掉到一半以下，本體消失
    {
      const splitId = Object.values(enemyById).find((d) => d.splitInto && !d.id.startsWith('hell_'))!;
      const cs = start('rats2', { act: 2 }, [...STARTER_DECK], 'split');
      const p = cs.player;
      cs.enemies.push({ ...cs.enemies[0]!, uid: 77, enemyId: splitId.id, hp: 40, maxHp: 40, dead: false, escaped: false, statuses: {} });
      const e = cs.enemies[cs.enemies.length - 1]!;
      cs.enemies[0]!.dead = true;   // 讓場上只剩這隻，免得分裂後判贏干擾
      runEnemyEffects(cs, e, [steal(1)], false, p);
      expect(p.hand.length).toBe(4);
      damageEnemy(cs, e, 30, { direct: true, by: p });
      expect(e.split).toBe(true);
      expect(e.dead).toBe(true);
      expect(e.escaped).toBe(true);
      expect(e.stolenCards).toBeUndefined();
      expect(p.hand.length).toBe(5);
    }
    // 散去（消散歸零）
    {
      const cs = start('hell_fuse_pair', { act: 2 }, [...STARTER_DECK, ...STARTER_DECK], 'fade');
      const p = cs.player; const e = cs.enemies[0]!;
      runEnemyEffects(cs, e, [steal(1)], false, p);
      expect(p.hand.length).toBe(4);
      e.statuses['消散'] = 1;
      endTurn(cs);                                          // 牠的回合結束少一層，歸零散去
      expect(e.faded).toBe(true);
      expect(e.stolenCards).toBeUndefined();
      expect(everywhere(cs).length).toBe(20);
    }
    // 換形態：血條式換血條（師父）
    {
      const cs = start('tower_master', { act: 2 }, [...STARTER_DECK], 'phase');
      const p = cs.player; const e = cs.enemies[0]!;
      runEnemyEffects(cs, e, [steal(1)], false, p);
      expect(e.stolenCards?.length).toBe(1);
      damageEnemy(cs, e, 99999, { direct: true, by: p });
      expect(e.dead).toBe(false);
      expect(e.phase).toBe(1);
      expect(e.stolenCards).toBeUndefined();
      expect(p.hand.length).toBe(5);
    }
    // 換形態：門檻式（貓又）
    {
      const def = Object.values(enemyById).find((d) => d.phases?.some((ph) => ph.hpBelow !== undefined))!;
      const cs = start(def.id, { act: 2 }, [...STARTER_DECK], 'phase2');
      const p = cs.player; const e = cs.enemies[0]!;
      runEnemyEffects(cs, e, [steal(1)], false, p);
      expect(e.stolenCards?.length).toBe(1);
      damageEnemy(cs, e, e.hp - 1, { direct: true, by: p });
      expect(e.phase).toBeGreaterThan(0);
      expect(e.stolenCards).toBeUndefined();
      expect(p.hand.length).toBe(5);
    }
    // 戰鬥結束：還活著的魔物身上有牌，勝（markCombatWon）、敗、結算（finishCombat）都要還
    {
      const cs = start('hell_fuse_pair', { act: 2 }, [...STARTER_DECK, ...STARTER_DECK], 'end');
      const p = cs.player; const e = cs.enemies[0]!;
      runEnemyEffects(cs, e, [steal(1)], false, p);
      expect(p.hand.length).toBe(4);
      returnAllStolen(cs);
      expect(p.hand.length).toBe(5);
      returnAllStolen(cs);                                  // 可以重複呼叫
      expect(p.hand.length).toBe(5);
    }
    {
      const run = newRun('chaos-run', 6);
      advanceAct(run);
      const node = run.map.nodes.find((n) => n.type === '戰鬥')!;
      run.currentNode = node.id;
      const cs = beginCombat(run, 'hell_pickpocket_monkey');
      const e = cs.enemies[0]!;
      runEnemyEffects(cs, e, [steal(1)], false, cs.player);
      expect(e.stolenCards?.length).toBe(1);
      const deckBefore = run.players[0]!.deck.map((c) => c.uid).sort((a, b) => a - b);
      cs.phase = 'lost';                                    // 打輸：不經過 markCombatWon
      finishCombat(run, cs);
      expect(e.stolenCards).toBeUndefined();                // 結算前先還
      expect(run.players[0]!.deck.map((c) => c.uid).sort((a, b) => a - b)).toEqual(deckBefore);   // 整局牌組一張沒少
    }
    {
      // 逃跑收尾：場上其他魔物都沒了，剩下偷牌的那隻逃走→判贏→markCombatWon 也還
      const cs = start('hell_fuse_pair', { act: 2 }, [...STARTER_DECK, ...STARTER_DECK], 'win');
      const p = cs.player;
      const [a, b] = cs.enemies as [EnemyCombat, EnemyCombat];
      runEnemyEffects(cs, a, [steal(1)], false, p);
      damageEnemy(cs, b, 9999, { direct: true, by: p });
      runEnemyEffects(cs, a, [{ kind: 'escape' }], false, p);
      expect(cs.phase).toBe('won');
      expect(p.hand.length).toBe(5);
    }
  });

  it('stolenReturnsToOriginalSeat：連線時偷誰還誰，原主倒下也還到他的座位，不給別人', () => {
    const run = newCoopRun('chaos-coop', 6, 'ninja', 'ninja');
    advanceAct(run);
    run.currentNode = run.map.nodes.find((n) => n.type === '戰鬥')!.id;
    const cs = beginCombat(run, 'hell_pickpocket_monkey');
    expect(cs.players.length).toBe(2);
    const [p0, p1] = cs.players as [typeof cs.player, typeof cs.player];
    const e = cs.enemies[0]!;
    const h0 = p0.hand.length, h1 = p1.hand.length;
    runEnemyEffects(cs, e, [steal(1)], false, p1);        // 這招瞄準 1 號
    expect(p0.hand.length).toBe(h0);
    expect(p1.hand.length).toBe(h1 - 1);
    expect(e.stolenCards!.map((s) => s.seat)).toEqual([1]);
    const card = e.stolenCards![0]!.card;
    p1.down = true;                                       // 原主倒下了
    p1.hp = 0;
    returnStolen(cs, e);
    expect(p1.hand.some((c) => c.uid === card.uid)).toBe(true);
    expect(p0.hand.some((c) => c.uid === card.uid)).toBe(false);
    expect(p0.hand.length).toBe(h0);
    // 倒下的人不偷
    runEnemyEffects(cs, e, [steal(1)], false, p1);
    expect(e.stolenCards).toBeUndefined();
    expect(e.stealPending).toBeUndefined();
  });

  it('手牌滿了（HAND_LIMIT）改進棄牌堆', () => {
    const cs = start();
    const p = cs.player;
    const e = cs.enemies[0]!;
    runEnemyEffects(cs, e, [steal(1)], false, p);
    const uid = e.stolenCards![0]!.card.uid;
    while (p.hand.length < HAND_LIMIT) p.hand.push(inst('sanjo', 5000 + p.hand.length));
    returnStolen(cs, e);
    expect(p.hand.length).toBe(HAND_LIMIT);
    expect(p.discardPile.some((c) => c.uid === uid)).toBe(true);
    expect(cs.log.some((l) => l.includes('棄牌堆了（手牌已滿）'))).toBe(true);
  });

  it('偷來的牌進連線指紋：兩邊不一致要抓得到', () => {
    const a = start('rats2', { act: 2 }, [...STARTER_DECK], 'fp');
    const b = start('rats2', { act: 2 }, [...STARTER_DECK], 'fp');
    expect(combatFingerprint(a)).toBe(combatFingerprint(b));
    runEnemyEffects(a, a.enemies[0]!, [steal(1)], false, a.player);
    expect(combatFingerprint(a)).not.toBe(combatFingerprint(b));
    // 待偷張數也算
    const c = start('rats2', { act: 2 }, [...STARTER_DECK], 'fp');
    const d = start('rats2', { act: 2 }, [...STARTER_DECK], 'fp');
    c.enemies[0]!.stealPending = [{ seat: 0, n: 1 }];
    expect(combatFingerprint(c)).not.toBe(combatFingerprint(d));
  });
});

describe('地獄第二關：封牌', () => {
  it('sealBlocksTypeNextTurnOnly：封條下一個玩家回合才生效，只管那一個回合，只封那一類', () => {
    const cs = start('rats2', { act: 2 }, ['sanjo', 'sanjo', 'sanjo', 'tanding', 'tanding', 'tanding', 'sanjo', 'tanding', 'sanjo', 'tanding']);
    const e = cs.enemies[0]!;
    const hand = (): { a: CardInstance; s: CardInstance } => ({ a: cs.player.hand.find((c) => typeOf(c) === 'attack')!, s: cs.player.hand.find((c) => typeOf(c) === 'skill')! });
    // 還沒生效：貼條的這個回合照常出牌
    runEnemyEffects(cs, e, [seal('attack')], false, cs.player);
    expect(cs.hell?.sealNext).toBe('attack');
    expect(cs.hell?.sealed).toBeUndefined();
    let h = hand();
    expect(canPlay(cs, h.a.uid, cs.enemies[0]!.uid).ok).toBe(true);
    endTurn(cs);                                            // 進下一個玩家回合：封條生效
    expect(cs.hell?.sealNext).toBeUndefined();
    expect(cs.hell?.sealed).toBe('attack');
    h = hand();
    const chk = canPlay(cs, h.a.uid, cs.enemies[0]!.uid);
    expect(chk.ok).toBe(false);
    if (!chk.ok) expect(chk.reason).toBe('被封住了，這回合打不出攻擊牌');
    expect(canPlay(cs, h.s.uid).ok).toBe(true);             // 技能牌照打
    endTurn(cs);                                            // 再下一個回合：沒有新封條，解封
    expect(cs.hell?.sealed).toBeUndefined();
    h = hand();
    expect(canPlay(cs, h.a.uid, cs.enemies[0]!.uid).ok).toBe(true);
  });

  it('封技能：技能牌打不出來、攻擊牌照打', () => {
    const cs = start('rats2', { act: 2 }, ['sanjo', 'sanjo', 'tanding', 'tanding', 'tanding', 'sanjo', 'sanjo', 'tanding', 'tanding', 'tanding']);
    sealType(cs, cs.enemies[0]!, 'skill');
    endTurn(cs);
    const a = cs.player.hand.find((c) => typeOf(c) === 'attack');
    const s = cs.player.hand.find((c) => typeOf(c) === 'skill')!;
    const chk = canPlay(cs, s.uid);
    expect(chk.ok).toBe(false);
    if (!chk.ok) expect(chk.reason).toBe('被封住了，這回合打不出技能牌');
    if (a) expect(canPlay(cs, a.uid, cs.enemies[0]!.uid).ok).toBe(true);
  });

  it('同一輪兩隻分別封攻擊、封技能：下一回合兩類都封（審查 2026-10-30 第 4 條：以前只留後出手那一張）', () => {
    const cs = start('rats2', { act: 2 }, ['sanjo', 'sanjo', 'tanding', 'tanding', 'tanding', 'sanjo', 'sanjo', 'tanding', 'tanding', 'tanding']);
    sealType(cs, cs.enemies[0]!, 'attack');
    sealType(cs, cs.enemies[0]!, 'skill');
    endTurn(cs);
    const a = cs.player.hand.find((c) => typeOf(c) === 'attack');
    const s = cs.player.hand.find((c) => typeOf(c) === 'skill');
    expect(a && s, '手上兩類都要有，否則這條什麼都沒驗').toBeTruthy();
    expect(canPlay(cs, a!.uid, cs.enemies[0]!.uid).ok).toBe(false);
    expect(canPlay(cs, s!.uid).ok).toBe(false);
    endTurn(cs);                                            // 只管那一個回合
    expect(cs.hell?.sealed).toBeUndefined();
  });

  it('同一類封兩次、或舊存檔裡的單一封條：照舊只封那一類（局面雜湊的內容跟以前一樣）', () => {
    const cs = start();
    sealType(cs, cs.enemies[0]!, 'attack');
    sealType(cs, cs.enemies[0]!, 'attack');
    expect(cs.hell?.sealNext).toBe('attack');
    endTurn(cs);
    expect(cs.hell?.sealed).toBe('attack');
  });

  it('sealNeverBlocksPower：能力牌不被封（攻擊與技能都封過一遍）', () => {
    for (const ty of ['attack', 'skill'] as const) {
      const cs = start('rats2', { act: 2 }, [...STARTER_DECK]);
      cs.player.hand.push(inst('jiejie', 900));
      expect(typeOf(cs.player.hand[cs.player.hand.length - 1]!)).toBe('power');
      cs.hell!.sealed = ty;
      expect(canPlay(cs, 900).ok, ty).toBe(true);
    }
  });

  it('連線兩位一起封', () => {
    const run = newCoopRun('seal-coop', 6, 'ninja', 'ninja');
    advanceAct(run);
    run.currentNode = run.map.nodes.find((n) => n.type === '戰鬥')!.id;
    const cs = beginCombat(run, 'hell_ofuda_ghost');
    cs.hell!.sealNext = 'attack';
    endTurn(cs);
    for (const seat of [0, 1]) {
      const a = cs.players[seat]!.hand.find((c) => typeOf(c) === 'attack');
      expect(a, `座位 ${seat} 手上要有攻擊牌，否則這條什麼都沒驗`).toBeDefined();
      expect(canPlay(cs, a!.uid, cs.enemies[0]!.uid, seat).ok, `座位 ${seat}`).toBe(false);
    }
  });

  it('一般難度（cs.hell 沒有）封牌什麼都不做，也不動 rng', () => {
    const cs = start('rats2', false);
    expect(cs.hell).toBeUndefined();
    const before = JSON.stringify(cs.rng.state);
    runEnemyEffects(cs, cs.enemies[0]!, [seal('attack')], false, cs.player);
    expect(cs.hell).toBeUndefined();
    expect(JSON.stringify(cs.rng.state)).toBe(before);
    const a = cs.player.hand.find((c) => typeOf(c) === 'attack')!;
    expect(canPlay(cs, a.uid, cs.enemies[0]!.uid).ok).toBe(true);
  });

  it('allSealedHandCanEndTurn：整手都是被封的那一類，結束回合照常走，不卡死', () => {
    const cs = start('rats2', { act: 2 }, Array(10).fill(atk()) as string[]);
    cs.hell!.sealNext = 'attack';
    endTurn(cs);
    expect(cs.hell?.sealed).toBe('attack');
    expect(cs.player.hand.length).toBe(5);
    expect(cs.player.hand.every((c) => !canPlay(cs, c.uid, cs.enemies[0]!.uid).ok)).toBe(true);
    const turn = cs.turn;
    endTurn(cs);
    expect(cs.turn).toBe(turn + 1);
    expect(cs.hell?.sealed).toBeUndefined();
  });

  it('機器人在地獄第二關整局跑完不逾時、不丟例外（封牌與偷牌都會碰到）', () => {
    for (let i = 0; i < 4; i++) {
      const r = smartRun(`seal-${i}`, 6, i % 2 ? 'ninja' : 'fengfeng' as never);
      expect(r.seed).toBe(`seal-${i}`);
      expect((r.diedTo ?? '').startsWith('僵局')).toBe(false);
    }
  }, 120000);
});

describe('地獄第二關：資料', () => {
  const ACT2 = ['pickpocket_monkey', 'ofuda_ghost', 'shuffle_fox', 'trash_goblin', 'paper_crane', 'dice_goblin', 'ink_brush', 'magpie_tengu', 'junk_mimic', 'ink_octopus', 'lock_spider', 'umbrella_thief', 'vault_tortoise', 'card_dragon', 'chain_warden', 'hoarder_toad'].map((n) => `hell_${n}`);

  it('第二關每隻魔物至少有一招「亂」：偷牌、封牌、塞牌或吹散手牌', () => {
    const chaos = new Set(['stealCard', 'sealType', 'giveCard', 'discardRandomHand']);
    for (const id of ACT2) {
      const def = enemyById[id]!;
      expect(def, id).toBeTruthy();
      expect(def.moves.some((m) => m.effects.some((fx) => chaos.has(fx.kind))), `${id} 沒有亂招`).toBe(true);
    }
  });

  it('偷牌的五隻與封牌的七隻（含關主）都換上新效果，不再留 Task 5 的替身', () => {
    const has = (id: string, kind: string): boolean => enemyById[`hell_${id}`]!.moves.some((m) => m.effects.some((fx) => fx.kind === kind));
    for (const id of ['pickpocket_monkey', 'junk_mimic', 'card_dragon', 'umbrella_thief', 'hoarder_toad']) expect(has(id, 'stealCard'), id).toBe(true);
    for (const id of ['ofuda_ghost', 'ink_brush', 'ink_octopus', 'lock_spider', 'vault_tortoise', 'chain_warden', 'hoarder_toad']) expect(has(id, 'sealType'), id).toBe(true);
    expect(hellEnemies.length).toBeGreaterThan(40);
  });

  it('第二關魔物的封牌招式不是空殼：貼上封條後下一回合真的有一類牌被封', () => {
    const cs = start('hell_ofuda_ghost', { act: 2 });
    const e = cs.enemies[0]!;
    expect(e.move.label).toBe('貼符');
    endTurn(cs);
    expect(cs.hell?.sealed).toBe('attack');
    expect(getStatus(cs.player, '懶洋洋')).toBe(0);   // 封牌取代了舊的懶洋洋替身
  });
});
