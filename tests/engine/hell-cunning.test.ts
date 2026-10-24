import { describe, expect, it } from 'vitest';
import { cardById, STARTER_DECK } from '../../src/content/cards';
import { enemyById } from '../../src/content/enemies';
import { hellEnemies } from '../../src/content/enemies-hell';
import { damageEnemy } from '../../src/engine/actions';
import { canPlay, endTurn, playCard, startCombat } from '../../src/engine/combat';
import { computeSeeThrough, cunningActive, recordPlay, seeThroughAmount, seeThroughScale } from '../../src/engine/hell';
import { Rng, seedFromString } from '../../src/engine/rng';
import { advanceAct, beginCombat, newCoopRun } from '../../src/engine/run';
import { smartRun } from '../../src/engine/smartbot';
import { getStatus } from '../../src/engine/statuses';
import type { CardInstance, CombatState } from '../../src/engine/types';
import { inst } from '../helpers';

/** 地獄第三關（或其他關／一般難度）的單人戰。預設打普通的鼠（沒有任何地獄機制） */
function start(encounterId = 'rats2', hell: false | { act: 1 | 2 | 3 } = { act: 3 }, deck: string[] = [...STARTER_DECK], seed = 'cunning'): CombatState {
  return startCombat({
    hp: 9999, maxHp: 9999, deck: deck.map((id, i) => inst(id, i + 1)), relics: [], potions: [], encounterId,
    rng: new Rng(seedFromString(seed)), ...(hell ? { hell } : {}),
  });
}

/** 把手牌直接換成指定的幾張（牌號從 900 起，不跟牌組撞） */
function handOf(cs: CombatState, ids: string[], seat = 0): CardInstance[] {
  const p = cs.players[seat]!;
  p.hand = ids.map((id, i) => inst(id, 900 + seat * 100 + i));
  return [...p.hand];   // 回副本：打牌會從手牌拿掉，不能邊打邊讀同一個陣列
}

describe('地獄第三關：看穿', () => {
  it('seeThroughAttackHalvesDamage：被看穿攻擊時，攻擊牌打魔物的傷害減半（捨去）', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    const [a] = handOf(cs, ['sanjo']);
    cs.hell!.seeThrough = 'attack';
    const hp0 = e.hp;
    expect(playCard(cs, a!.uid, e.uid)).toBe(true);
    expect(hp0 - e.hp).toBe(3);   // 貓抓 6 → 3
  });

  it('seeThroughAttackHalvesDamage：奇數捨去、最少 1，爪力加成算進去之後才減半', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    const [a] = handOf(cs, ['sanjo']);
    cs.hell!.seeThrough = 'attack';
    cs.player.statuses['爪力'] = 3;   // 6+3＝9 → 4
    const hp0 = e.hp;
    playCard(cs, a!.uid, e.uid);
    expect(hp0 - e.hp).toBe(4);
  });

  it('seeThroughAttackHalvesDamage：沒被看穿攻擊就照原傷害（看穿技能時攻擊不受影響）', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    const [a] = handOf(cs, ['sanjo']);
    cs.hell!.seeThrough = 'skill';
    const hp0 = e.hp;
    playCard(cs, a!.uid, e.uid);
    expect(hp0 - e.hp).toBe(6);
  });

  it('seeThroughSkillHalvesBlockAndDebuff：被看穿技能時，技能牌給的蜷縮與對魔物上的減益層數減半', () => {
    const cs = start();
    const e = cs.enemies[0]!;
    const [d, t] = handOf(cs, ['tanding', 'dingshang']);
    cs.hell!.seeThrough = 'skill';
    const b0 = cs.player.block;
    playCard(cs, d!.uid);
    expect(cs.player.block - b0).toBe(2);               // 淡定 5 → 2
    playCard(cs, t!.uid, e.uid);
    expect(getStatus(e, '翻肚')).toBe(1);               // 翻肚 2 → 1
  });

  it('seeThroughSkillHalvesBlockAndDebuff：捨去、最少 1、0 維持 0（一層減益不會被減成沒有）', () => {
    const cs = start();
    cs.hell!.seeThrough = 'skill';
    expect(seeThroughScale(cs, 'skill')).toBe(0.5);
    expect(seeThroughScale(cs, 'attack')).toBe(1);
    expect([0, 1, 2, 5, 9].map((n) => seeThroughAmount(cs, 'skill', n))).toEqual([0, 1, 1, 2, 4]);
    expect([0, 1, 5].map((n) => seeThroughAmount(cs, 'attack', n))).toEqual([0, 1, 5]);   // 沒被看穿的那類原樣
  });

  it('seeThroughSkillHalvesBlockAndDebuff：看穿技能不影響攻擊牌的傷害', () => {
    const cs = start();
    cs.hell!.seeThrough = 'skill';
    const [a] = handOf(cs, ['sanjo']);
    const e = cs.enemies[0]!;
    const hp0 = e.hp;
    playCard(cs, a!.uid, e.uid);
    expect(hp0 - e.hp).toBe(6);
  });

  it('powerCardsIgnored：能力牌不記進統計，也不受看穿影響；秘寶與魔物來源的效果不減半', () => {
    const cs = start();
    const [pw] = handOf(cs, ['jiejie']);
    cs.hell!.seeThrough = 'skill';
    expect(cardById['jiejie']!.type).toBe('power');
    playCard(cs, pw!.uid);
    expect(cs.hell!.lastPlays ?? { attack: 0, skill: 0 }).toEqual({ attack: 0, skill: 0 });
    // 能力牌掛上的效果（回合開始給蜷縮 3）原樣，不被看穿減半
    expect(cs.player.powers[0]?.effects).toEqual([{ kind: 'block', amount: 3 }]);
    // 不是牌打的傷害（直傷）不減半
    const e = cs.enemies[0]!;
    cs.hell!.seeThrough = 'attack';
    const hp0 = e.hp;
    damageEnemy(cs, e, 6, { by: cs.player });
    expect(hp0 - e.hp).toBe(6);
  });

  it('seeThroughNullOnTieOrNoPlays：第一回合、沒出牌、攻擊技能平手都是 null；只看上一回合', () => {
    // 第一回合：還沒有上一回合
    const cs = start();
    expect(cs.hell!.seeThrough ?? null).toBeNull();
    // 上一回合一張牌都沒打
    endTurn(cs);
    expect(cs.hell!.seeThrough ?? null).toBeNull();
    // 打 1 攻擊 1 技能＝平手
    const [a, d] = handOf(cs, ['sanjo', 'tanding']);
    playCard(cs, a!.uid, cs.enemies[0]!.uid);
    playCard(cs, d!.uid);
    endTurn(cs);
    expect(cs.hell!.seeThrough ?? null).toBeNull();
    // 攻擊多 → 看穿攻擊
    const hand = handOf(cs, ['sanjo', 'sanjo', 'tanding']);
    playCard(cs, hand[0]!.uid, cs.enemies[0]!.uid);
    playCard(cs, hand[1]!.uid, cs.enemies[0]!.uid);
    playCard(cs, hand[2]!.uid);
    endTurn(cs);
    expect(cs.hell!.seeThrough).toBe('attack');
    // 這一回合改打技能、攻擊沒出：下一回合看穿換成技能（只看上一回合，不累計）
    const h2 = handOf(cs, ['tanding', 'tanding']);
    playCard(cs, h2[0]!.uid);
    playCard(cs, h2[1]!.uid);
    endTurn(cs);
    expect(cs.hell!.seeThrough).toBe('skill');
    // 再空過一回合：上一回合沒出牌，看穿消失
    endTurn(cs);
    expect(cs.hell!.seeThrough ?? null).toBeNull();
  });

  it('seeThroughNullOnTieOrNoPlays：看穿只管那一個玩家回合，魔物回合開始前就清掉', () => {
    const cs = start();
    cs.hell!.seeThrough = 'attack';
    cs.hell!.lastPlays = { attack: 0, skill: 0 };
    endTurn(cs);
    expect(cs.hell!.seeThrough ?? null).toBeNull();
  });

  it('coopPlaysSummed：連線兩位上一回合的出牌合起來算', () => {
    const run = newCoopRun('cunning-coop', 6, 'ninja', 'ninja');
    advanceAct(run); advanceAct(run);
    run.currentNode = run.map.nodes.find((n) => n.type === '戰鬥')!.id;
    const cs = beginCombat(run, 'hell_spy_crow');
    expect(cs.hell?.act).toBe(3);
    expect(cs.players.length).toBe(2);
    const e = cs.enemies[0]!;
    const h0 = handOf(cs, ['tanding', 'tanding'], 0);
    const h1 = handOf(cs, ['sanjo', 'sanjo', 'tanding'], 1);
    playCard(cs, h0[0]!.uid, undefined, 0);
    playCard(cs, h0[1]!.uid, undefined, 0);
    playCard(cs, h1[0]!.uid, e.uid, 1);
    playCard(cs, h1[1]!.uid, e.uid, 1);
    playCard(cs, h1[2]!.uid, undefined, 1);
    expect(cs.hell!.lastPlays).toEqual({ attack: 2, skill: 3 });   // 座位 1 單看是攻擊多，合起來是技能多
    expect(cs.enemies[0]!.dead).toBe(false);
    endTurn(cs);
    expect(cs.hell!.seeThrough).toBe('skill');
  });

  it('act1NoSeeThrough：第一、二關與一般難度不記出牌、不算看穿、不擲骰', () => {
    for (const hell of [false as const, { act: 1 as const }, { act: 2 as const }]) {
      const cs = start('rats2', hell);
      expect(cunningActive(cs)).toBe(false);
      const [a, d] = handOf(cs, ['sanjo', 'tanding']);
      const before = JSON.stringify(cs.rng.state);
      playCard(cs, a!.uid, cs.enemies[0]!.uid);
      playCard(cs, d!.uid);
      recordPlay(cs, 'attack');
      computeSeeThrough(cs);
      expect(cs.hell?.lastPlays).toBeUndefined();
      expect(cs.hell?.seeThrough).toBeUndefined();
      // 沒有看穿就不縮放
      expect(seeThroughScale(cs, 'attack')).toBe(1);
      expect(seeThroughScale(cs, 'skill')).toBe(1);
      void before;
    }
    // 一般難度打到結束，hell 欄位從頭到尾都沒有
    const cs = start('rats2', false);
    for (let i = 0; i < 3; i++) { const [a] = handOf(cs, ['sanjo']); playCard(cs, a!.uid, cs.enemies[0]!.uid); endTurn(cs); }
    expect(cs.hell).toBeUndefined();
  });

  it('看穿本身不擲骰：算看穿前後 cs.rng 不動', () => {
    const cs = start();
    cs.hell!.lastPlays = { attack: 3, skill: 1 };
    const before = JSON.stringify(cs.rng.state);
    computeSeeThrough(cs);
    expect(JSON.stringify(cs.rng.state)).toBe(before);
    expect(cs.hell!.seeThrough).toBe('attack');
    expect(cs.hell!.lastPlays).toBeUndefined();   // 算完清掉
  });
});

describe('地獄第三關：配合', () => {
  /** 場上兩隻以上：影武者貓（嘲諷）＋雙子・月 */
  const tauntFight = (): CombatState => start('hell_cat_moon', { act: 3 });
  const uidOf = (cs: CombatState, id: string): number => cs.enemies.find((e) => e.enemyId === id)!.uid;

  it('data：第三關至少兩種嘲諷、至少兩種同伴倒下暴怒', () => {
    const act3 = hellEnemies.filter((d) => ['hell_spy_crow', 'hell_smoke_rat', 'hell_mirror_eye', 'hell_banner_imp', 'hell_medicine_bat', 'hell_shell_kappa',
      'hell_twin_moon', 'hell_twin_sun', 'hell_strategist_owl', 'hell_kagemusha_cat', 'hell_war_drum_frog', 'hell_vengeful_doll'].includes(d.id));
    expect(act3.filter((d) => d.taunt).map((d) => d.id).sort()).toEqual(['hell_kagemusha_cat', 'hell_shell_kappa']);
    expect(act3.filter((d) => d.enrageOnAllyDeath).map((d) => d.id).sort()).toEqual(['hell_twin_moon', 'hell_twin_sun', 'hell_vengeful_doll']);
    expect(enemyById['hell_kagemusha_cat']!.taunt).toBe(true);
  });

  it('tauntRedirectsSingleTarget：嘲諷的活著時，單體攻擊打其他魔物改打牠', () => {
    const cs = tauntFight();
    const cat = cs.enemies.find((e) => e.enemyId === 'hell_kagemusha_cat')!;
    const moon = cs.enemies.find((e) => e.enemyId === 'hell_twin_moon')!;
    const [a] = handOf(cs, ['sanjo']);
    const catHp = cat.hp + cat.block, moonHp = moon.hp;
    expect(canPlay(cs, a!.uid, moon.uid).ok).toBe(true);
    expect(playCard(cs, a!.uid, moon.uid)).toBe(true);
    expect(moon.hp).toBe(moonHp);                       // 沒打到被點名的
    expect(cat.hp + cat.block).toBeLessThan(catHp);     // 嘲諷的挨了
    expect(cs.log.some((l) => l.includes('嘲諷'))).toBe(true);
  });

  it('tauntRedirectsSingleTarget：全體攻擊、直接點嘲諷的本人不受影響；嘲諷的倒了就不再導向', () => {
    const cs = tauntFight();
    const cat = cs.enemies.find((e) => e.enemyId === 'hell_kagemusha_cat')!;
    const moon = cs.enemies.find((e) => e.enemyId === 'hell_twin_moon')!;
    const [aoe] = handOf(cs, ['susu']);
    expect(cardById['susu']!.target).toBe('all');
    const moonHp = moon.hp;
    cs.player.energy = 9;
    playCard(cs, aoe!.uid);
    expect(moon.hp).toBeLessThan(moonHp);               // 全體照打
    // 打倒嘲諷的之後單體攻擊回到原目標
    damageEnemy(cs, cat, 99999, { direct: true, by: cs.player });
    expect(cat.dead).toBe(true);
    const [a] = handOf(cs, ['sanjo']);
    const hp1 = moon.hp + moon.block;
    playCard(cs, a!.uid, moon.uid);
    expect(moon.hp + moon.block).toBeLessThan(hp1);
  });

  it('tauntRedirectsSingleTarget：逃走的嘲諷不算；多隻嘲諷照魔物順序取第一隻；不是攻擊牌的單體技能不導向', () => {
    const cs = tauntFight();
    const cat = cs.enemies.find((e) => e.enemyId === 'hell_kagemusha_cat')!;
    const moon = cs.enemies.find((e) => e.enemyId === 'hell_twin_moon')!;
    // 單體技能（盯上你了：上翻肚）不導向
    const [t] = handOf(cs, ['dingshang']);
    playCard(cs, t!.uid, moon.uid);
    expect(getStatus(moon, '翻肚')).toBeGreaterThan(0);
    expect(getStatus(cat, '翻肚')).toBe(0);
    // 嘲諷的逃走了：不再導向
    cat.escaped = true;
    const [a] = handOf(cs, ['sanjo']);
    const hp0 = moon.hp + moon.block;
    playCard(cs, a!.uid, moon.uid);
    expect(moon.hp + moon.block).toBeLessThan(hp0);
    cat.escaped = false;
    // 兩隻嘲諷（再把雙子・月設成嘲諷）：取順序在前的那隻
    const cs2 = start('hell_owl_kappa', { act: 3 });
    const kappa = cs2.enemies.find((e) => e.enemyId === 'hell_shell_kappa')!;
    const owl = cs2.enemies.find((e) => e.enemyId === 'hell_strategist_owl')!;
    expect(kappa).toBeDefined();
    const [b] = handOf(cs2, ['sanjo']);
    const owlHp = owl.hp;
    playCard(cs2, b!.uid, owl.uid);
    expect(owl.hp).toBe(owlHp);                          // 河童也嘲諷：改打河童
    expect(uidOf(cs2, 'hell_shell_kappa')).toBe(kappa.uid);
  });

  it('enrageOnAllyDeath：同伴被打倒時，帶暴怒的那隻爪力 +n；自己倒下、非暴怒的不受影響', () => {
    const cs = start('hell_twins', { act: 3 });
    const moon = cs.enemies.find((e) => e.enemyId === 'hell_twin_moon')!;
    const sun = cs.enemies.find((e) => e.enemyId === 'hell_twin_sun')!;
    const sunClaw = getStatus(sun, '爪力');
    damageEnemy(cs, moon, 99999, { direct: true, by: cs.player });
    expect(moon.dead).toBe(true);
    expect(getStatus(sun, '爪力') - sunClaw).toBe(enemyById['hell_twin_sun']!.enrageOnAllyDeath);
    expect(cs.log.some((l) => l.includes('暴怒'))).toBe(true);

    const cs2 = start('hell_kappa_doll', { act: 3 });
    const kappa = cs2.enemies.find((e) => e.enemyId === 'hell_shell_kappa')!;
    const doll = cs2.enemies.find((e) => e.enemyId === 'hell_vengeful_doll')!;
    const dollClaw = getStatus(doll, '爪力'), kappaClaw = getStatus(kappa, '爪力');
    damageEnemy(cs2, kappa, 99999, { direct: true, by: cs2.player });
    expect(getStatus(doll, '爪力') - dollClaw).toBe(enemyById['hell_vengeful_doll']!.enrageOnAllyDeath);
    expect(getStatus(kappa, '爪力')).toBe(kappaClaw);
  });

  it('enrageOnAllyDeath：同生共死會爬回來的、逃走的不算死；身邊只剩自己倒下也不報錯', () => {
    const cs = start('hell_twins', { act: 3 });
    const moon = cs.enemies.find((e) => e.enemyId === 'hell_twin_moon')!;
    const sun = cs.enemies.find((e) => e.enemyId === 'hell_twin_sun')!;
    damageEnemy(cs, sun, 99999, { direct: true, by: cs.player });
    damageEnemy(cs, moon, 99999, { direct: true, by: cs.player });   // 最後一隻倒下：沒有誰可暴怒
    expect(cs.phase).toBe('won');
  });

  it('smartbot：d6 一局跑得完、不當機（目標被導向也照常出牌）', () => {
    const r = smartRun('cunning-bot', 6, 'ninja');
    expect(r).toBeDefined();
  });
});
