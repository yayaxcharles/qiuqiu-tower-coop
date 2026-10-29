// 魔源真身連線時兩位的牌都學（使用者 2026-10-30 裁定）：原本只看座位 0 打的牌，座位 1 打什麼都不會被學
import { describe, expect, it } from 'vitest';
import { starterDeckFor } from '../../src/content/cards';
import { damageEnemy } from '../../src/engine/actions';
import { endTurn, playCard, startCombat } from '../../src/engine/combat';
import type { Hero } from '../../src/engine/hero';
import { learnedMove } from '../../src/engine/mimic';
import { Rng, seedFromString } from '../../src/engine/rng';
import { addStatus } from '../../src/engine/statuses';
import type { CardInstance, CombatState, EnemyCombat, EnemyMove, PlayerCombat } from '../../src/engine/types';
import { inst } from '../helpers';

const SOURCE = 'hell_source';

function start(hero: Hero, seed: string, encounterId = SOURCE, extra: readonly string[] = []): CombatState {
  const deck = [...starterDeckFor(hero), ...extra].map((id, i) => inst(id, i + 1));
  return startCombat({
    hp: 9999, maxHp: 9999, deck, relics: [], potions: [], encounterId, hero,
    rng: new Rng(seedFromString(seed)), ...(encounterId === SOURCE ? { hell: { act: 3 as const } } : {}),
  });
}

/** 打到真身（第四形態），中間每次換形態都等調息那一回合過去 */
function toTrueForm(cs: CombatState): EnemyCombat {
  const e = cs.enemies.find((x) => x.enemyId === SOURCE)!;
  while (e.phase < 3) {
    e.block = 0;
    damageEnemy(cs, e, 99999, { direct: true, by: cs.player });
    e.invulnIn = 0;
    e.moveIndex = -1;
    endTurn(cs);
  }
  return e;
}

/** 手動補一位座位 1 的同伴（四堆牌與這回合打出的牌照給） */
function addMate(cs: CombatState, hero: Hero, deck: readonly string[], played: readonly string[]): PlayerCombat {
  const cards = deck.map((id, i) => inst(id, 500 + i));
  const mate = {
    ...cs.player, seat: 1, hero, down: false, statuses: {},
    drawPile: cards, hand: [], discardPile: [], exhaustPile: [],
    playedThisTurn: played.map((id, i) => inst(id, 700 + i)),
  } as PlayerCombat;
  cs.players.push(mate);
  return mate;
}

const played = (ids: readonly string[], base = 800): CardInstance[] => ids.map((id, i) => inst(id, base + i));
const rec = (m: EnemyMove | undefined): string => JSON.stringify(m ? { l: m.label, f: m.effects, d: m.learned } : null);

/**
 * 單機（只有一位）在這次修改前後要一個位元都不差。下面的快照是在**改 mimic.ts 之前**跑出來凍住的：
 * 四位主角各自的真身照抄、退回隨機抽、封封的蓄氣、菲菲的見血封喉，以及走真的 endTurn 打幾回合。
 */
function singleScenarios(): string[] {
  const out: string[] = [];
  const extras: Record<Hero, string[]> = {
    ninja: ['susu', 'ruying'], feifei: ['feifei_zhenyu', 'feifei_jianxue'],
    dangdang: ['dangdang_bengshan', 'dangdang_yingkang'], fengfeng: ['fengfeng_tabu', 'fengfeng_pozhen'],
  } as Record<Hero, string[]>;
  for (const hero of ['ninja', 'feifei', 'dangdang', 'fengfeng'] as Hero[]) {
    const cs = start(hero, `base-${hero}`, SOURCE, extras[hero]);
    const e = toTrueForm(cs);
    const deck = starterDeckFor(hero);
    out.push(`${hero} enter ${rec(e.move)}`);
    cs.player.playedThisTurn = played([deck[0]!, extras[hero][0]!, deck[deck.length - 1]!]);
    out.push(`${hero} played ${rec(learnedMove(cs, e))}`);
    e.turnCount = 2;
    out.push(`${hero} t3 ${rec(learnedMove(cs, e))}`);
    cs.player.playedThisTurn = [];
    out.push(`${hero} rand1 ${rec(learnedMove(cs, e))}`);
    out.push(`${hero} rand2 ${rec(learnedMove(cs, e))}`);
    e.turnCount = 0;
    for (let t = 0; t < 3; t++) {
      const card = cs.player.hand.find((c) => playCard(cs, c.uid, e.uid));
      endTurn(cs);
      out.push(`${hero} turn${t} ${card?.cardId ?? '-'} ${rec(e.move)}`);
      if (cs.phase !== 'player') break;
    }
    if (hero === 'feifei') {
      addStatus(cs.player, '中毒', 8);
      out.push(`${hero} exec ${rec(learnedMove(cs, e))}`);
    }
  }
  return out;
}

describe('魔源真身：單機行為不變', () => {
  it('四位主角的真身照抄／隨機抽／招牌加成，跟修改前完全相同', () => {
    expect(singleScenarios().join('\n')).toMatchInlineSnapshot(`
      "ninja enter {"l":"如影隨形（影分身）","f":[{"kind":"damage","amount":5,"times":3},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"ruying","upgraded":false}]}
      ninja played {"l":"速速退散（影分身）","f":[{"kind":"damage","amount":9,"times":2}],"d":[{"cardId":"susu","upgraded":false}]}
      ninja t3 {"l":"速速退散（影分身）","f":[{"kind":"damage","amount":9,"times":2}],"d":[{"cardId":"susu","upgraded":false}]}
      ninja rand1 {"l":"淡定","f":[{"kind":"block","amount":5}],"d":[{"cardId":"tanding","upgraded":false}]}
      ninja rand2 {"l":"淡定","f":[{"kind":"block","amount":5}],"d":[{"cardId":"tanding","upgraded":false}]}
      ninja turn0 sanjo {"l":"貓抓（影分身）","f":[{"kind":"damage","amount":6,"times":2},{"kind":"sealType","type":"skill"},{"kind":"giveCard","cardId":"dazed_card","n":2,"to":"draw"}],"d":[{"cardId":"sanjo","upgraded":false}]}
      ninja turn1 dazed_card {"l":"貓抓（影分身）","f":[{"kind":"damage","amount":6,"times":2},{"kind":"stealCard","n":2},{"kind":"sealType","type":"skill"}],"d":[{"cardId":"sanjo","upgraded":false}]}
      ninja turn2 sanjo {"l":"貓抓（影分身）","f":[{"kind":"damage","amount":6,"times":2},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"sanjo","upgraded":false}]}
      feifei enter {"l":"飛針","f":[{"kind":"damage","amount":3},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"block","amount":1},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"feifei_feizhen","upgraded":false}]}
      feifei played {"l":"針雨","f":[{"kind":"damage","amount":3},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"statusPlayer","name":"中毒","amount":3},{"kind":"block","amount":5}],"d":[{"cardId":"feifei_zhenyu","upgraded":false}]}
      feifei t3 {"l":"針雨","f":[{"kind":"damage","amount":3},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"statusPlayer","name":"中毒","amount":3},{"kind":"block","amount":5}],"d":[{"cardId":"feifei_zhenyu","upgraded":false}]}
      feifei rand1 {"l":"退開","f":[{"kind":"block","amount":5}],"d":[{"cardId":"feifei_tuikai","upgraded":false}]}
      feifei rand2 {"l":"飛針","f":[{"kind":"damage","amount":3},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"block","amount":1}],"d":[{"cardId":"feifei_feizhen","upgraded":false}]}
      feifei turn0 feifei_tuikai {"l":"退開","f":[{"kind":"block","amount":5},{"kind":"sealType","type":"skill"},{"kind":"giveCard","cardId":"dazed_card","n":2,"to":"draw"}],"d":[{"cardId":"feifei_tuikai","upgraded":false}]}
      feifei turn1 dazed_card {"l":"退開","f":[{"kind":"block","amount":5},{"kind":"stealCard","n":2},{"kind":"sealType","type":"skill"}],"d":[{"cardId":"feifei_tuikai","upgraded":false}]}
      feifei turn2 feifei_feizhen {"l":"飛針","f":[{"kind":"damage","amount":3},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"statusPlayer","name":"中毒","amount":1},{"kind":"block","amount":1},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"feifei_feizhen","upgraded":false}]}
      feifei exec {"l":"見血封喉","f":[{"kind":"damageByPlayerStatus","name":"中毒"}]}
      dangdang enter {"l":"正拳","f":[{"kind":"damage","amount":5},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"dangdang_zhengquan","upgraded":false}]}
      dangdang played {"l":"崩山掌","f":[{"kind":"damage","amount":12}],"d":[{"cardId":"dangdang_bengshan","upgraded":false}]}
      dangdang t3 {"l":"崩山掌","f":[{"kind":"damage","amount":12}],"d":[{"cardId":"dangdang_bengshan","upgraded":false}]}
      dangdang rand1 {"l":"正拳","f":[{"kind":"damage","amount":5}],"d":[{"cardId":"dangdang_zhengquan","upgraded":false}]}
      dangdang rand2 {"l":"正拳","f":[{"kind":"damage","amount":5}],"d":[{"cardId":"dangdang_zhengquan","upgraded":false}]}
      dangdang turn0 dangdang_zhengquan {"l":"正拳","f":[{"kind":"damage","amount":5},{"kind":"sealType","type":"skill"},{"kind":"giveCard","cardId":"dazed_card","n":2,"to":"draw"}],"d":[{"cardId":"dangdang_zhengquan","upgraded":false}]}
      dangdang turn1 dangdang_jiapan {"l":"架盤","f":[{"kind":"block","amount":5},{"kind":"stealCard","n":2},{"kind":"sealType","type":"skill"}],"d":[{"cardId":"dangdang_jiapan","upgraded":false}]}
      dangdang turn2 dangdang_zhengquan {"l":"正拳","f":[{"kind":"damage","amount":5},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"dangdang_zhengquan","upgraded":false}]}
      fengfeng enter {"l":"護身","f":[{"kind":"block","amount":6},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"fengfeng_hushen","upgraded":false}]}
      fengfeng played {"l":"踏步重劈","f":[{"kind":"damage","amount":29}],"d":[{"cardId":"fengfeng_tabu","upgraded":false}]}
      fengfeng t3 {"l":"踏步重劈（蓄氣）","f":[{"kind":"damage","amount":29},{"kind":"chargeNext"}],"d":[{"cardId":"fengfeng_tabu","upgraded":false}]}
      fengfeng rand1 {"l":"護身（蓄氣）","f":[{"kind":"block","amount":6},{"kind":"chargeNext"}],"d":[{"cardId":"fengfeng_hushen","upgraded":false}]}
      fengfeng rand2 {"l":"平斬（蓄氣）","f":[{"kind":"damage","amount":17},{"kind":"chargeNext"}],"d":[{"cardId":"fengfeng_pingzhan","upgraded":false}]}
      fengfeng turn0 fengfeng_hushen {"l":"護身","f":[{"kind":"block","amount":6},{"kind":"sealType","type":"skill"},{"kind":"giveCard","cardId":"dazed_card","n":2,"to":"draw"}],"d":[{"cardId":"fengfeng_hushen","upgraded":false}]}
      fengfeng turn1 fengfeng_tuna {"l":"護身（蓄氣）","f":[{"kind":"block","amount":6},{"kind":"chargeNext"},{"kind":"stealCard","n":2},{"kind":"sealType","type":"skill"}],"d":[{"cardId":"fengfeng_hushen","upgraded":false}]}
      fengfeng turn2 fengfeng_pingzhan {"l":"平斬","f":[{"kind":"damage","amount":17},{"kind":"sealType","type":"attack"},{"kind":"giveCard","cardId":"dazed_card","n":3,"to":"draw"}],"d":[{"cardId":"fengfeng_pingzhan","upgraded":false}]}"
    `);
  });
});

describe('魔源真身：連線時兩位的牌都學', () => {
  it('座位 1 打的高費牌會被學到；招牌照那張牌的出牌者算（菲菲的毒，不套座位 0 球球的影分身）', () => {
    const cs = start('ninja', 'coop-a');
    const e = toTrueForm(cs);
    cs.player.playedThisTurn = played(['sanjo']);           // 1 費
    addMate(cs, 'feifei', starterDeckFor('feifei'), ['feifei_zhenyu']);   // 2 費
    const m = learnedMove(cs, e)!;
    expect(m.learned?.map((c) => c.cardId)).toEqual(['feifei_zhenyu']);
    expect(m.learned?.[0]?.hero).toBe('feifei');
    expect(m.effects.some((f) => f.kind === 'statusPlayer' && f.name === '中毒')).toBe(true);
    expect(m.label).not.toContain('影分身');
  });

  it('同費用時座位 0 先；座位 0 的牌照樣吃球球的影分身', () => {
    const cs = start('ninja', 'coop-b');
    const e = toTrueForm(cs);
    cs.player.playedThisTurn = played(['sanjo']);
    addMate(cs, 'feifei', starterDeckFor('feifei'), ['feifei_feizhen']);   // 也是 1 費
    const m = learnedMove(cs, e)!;
    expect(m.learned?.map((c) => c.cardId)).toEqual(['sanjo']);
    expect(m.learned?.[0]?.hero).toBe('ninja');
    expect(m.label).toContain('影分身');
    expect(m.effects.some((f) => f.kind === 'statusPlayer' && f.name === '中毒')).toBe(false);
  });

  it('座位 0 倒下或沒出牌時改學座位 1 的牌，不退回隨機抽', () => {
    const cs = start('ninja', 'coop-c');
    const e = toTrueForm(cs);
    cs.player.playedThisTurn = [];
    addMate(cs, 'dangdang', starterDeckFor('dangdang'), ['dangdang_zhengquan']);
    const rngBefore = JSON.stringify(cs.rng);
    expect(learnedMove(cs, e)!.learned?.map((c) => c.cardId)).toEqual(['dangdang_zhengquan']);
    expect(JSON.stringify(cs.rng)).toBe(rngBefore);   // 沒動到亂數＝沒走隨機抽
    cs.player.playedThisTurn = played(['susu']);
    cs.player.down = true;
    expect(learnedMove(cs, e)!.learned?.map((c) => c.cardId)).toEqual(['dangdang_zhengquan']);
  });

  it('兩位都沒出牌：從兩位沒倒下的人牌組裡隨機抽；同一個局面兩邊抽到同一張', () => {
    const run = (): EnemyMove => {
      const cs = start('ninja', 'coop-d');
      const e = toTrueForm(cs);
      cs.player.playedThisTurn = [];
      addMate(cs, 'feifei', starterDeckFor('feifei'), []);
      return learnedMove(cs, e)!;
    };
    const a = run();
    const b = run();
    expect(a.learned).toHaveLength(1);
    expect(a).toEqual(b);
    const pool = new Set([...starterDeckFor('ninja'), ...starterDeckFor('feifei')]);
    expect(pool.has(a.learned![0]!.cardId)).toBe(true);
    // 座位 0 倒下：只從座位 1 的牌組抽
    for (let i = 0; i < 6; i++) {
      const cs = start('ninja', `coop-down-${i}`);
      const e = toTrueForm(cs);
      cs.player.playedThisTurn = [];
      cs.player.down = true;
      addMate(cs, 'feifei', starterDeckFor('feifei'), []);
      expect(starterDeckFor('feifei')).toContain(learnedMove(cs, e)!.learned![0]!.cardId);
    }
  });

  it('一般的影子魔物（鏡中球球）連線時照舊只照座位 0', () => {
    const cs = start('ninja', 'coop-e', 'mirror_duel');
    const e = cs.enemies[0]!;
    cs.player.playedThisTurn = played(['sanjo']);
    addMate(cs, 'feifei', starterDeckFor('feifei'), ['feifei_jianxue']);
    const m = learnedMove(cs, e)!;
    expect(m.learned).toEqual([{ cardId: 'sanjo', upgraded: false }]);
  });
});
