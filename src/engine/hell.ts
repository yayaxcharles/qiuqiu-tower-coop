/**
 * 難度 6「地獄」的戰鬥內狀態與機制（設計：docs/superpowers/specs/2026-10-21-hell-difficulty-design.md）。
 *
 * **閘門**：一般難度（1～5）`cs.hell` 永遠是 undefined，這裡的函式一律先看它、沒有就直接回，
 * 不動狀態、不碰 `cs.rng`——所以難度 1～5 的每一局逐位元不變。
 * 機制只看**所在關數**（`act`），不看對手是不是地獄魔物（事件對手、問號格伏擊也照關數套）。
 */
import { encounterById, enemyById } from '../content/enemies';
import { HAND_LIMIT } from './deck';
import { log } from './actions';
import { E, H } from './logfmt';
import { addStatus } from './statuses';
import { DEBUFFS } from './types';
import type { CardDef, CardType, CombatState, Effect, EnemyCombat, EnemyPhase, HellMech, PlayerCombat, StatusName } from './types';

export interface HellState {
  act: 1 | 2 | 3;
  miasmaLeft?: number;                 // 只有第一關（與魔源第一形態）有；0＝已歸零
  sealNext?: 'attack' | 'skill';       // 魔物剛貼的封條：下一個玩家回合才生效
  sealed?: 'attack' | 'skill';         // 這個玩家回合被封住的那一類牌（兩位一起封）
  lastPlays?: { attack: number; skill: number };  // Task 6
  seeThrough?: 'attack' | 'skill' | null;          // Task 6
  doom?: number;                   // 魔源真身的滅世倒數：0＝這一輪頭上亮著滅世（放完下一輪重新起算）
}

/** 紫霧起始倒數（玩家回合數）：一般戰、大魔物、關主。量測再調 */
export const MIASMA_TURNS: Record<'normal' | 'elite' | 'boss', number> = { normal: 6, elite: 8, boss: 10 };

/** 紫霧歸零後，每一輪魔物各加的爪力 */
export const MIASMA_CLAW = 2;

/** 魔源（形態自己開紫霧）的倒數：比一般關主（10）短一半，第一形態與真身重新起算都用這個（2026-10-24 由 8 縮到 5） */
export const SOURCE_MIASMA_TURNS = 5;

/**
 * 魔源每一輪紫霧加的爪力，照**目前的形態**（`EnemyCombat.phase`，0～3）：第一形態 4、真身（第四形態）5。
 * 只有關主戰會用到；第一關的紫霧（一般戰、大魔物、時沙將軍）永遠照 `MIASMA_CLAW`。
 */
export const SOURCE_MIASMA_CLAW: readonly number[] = [4, 4, 4, 5];

/** 這一輪紫霧要加多少爪力：第一關照 `MIASMA_CLAW`；其他關看場上帶紫霧的那隻關主現在的形態 */
export function miasmaClaw(cs: CombatState): number {
  if (!cs.hell || cs.hell.act === 1) return MIASMA_CLAW;
  const src = cs.enemies.find((e) => !e.dead && formMechs(e)?.includes('miasma') === true);
  return src ? SOURCE_MIASMA_CLAW[Math.min(src.phase, SOURCE_MIASMA_CLAW.length - 1)] ?? MIASMA_CLAW : MIASMA_CLAW;
}

/** 開戰時呼叫一次（`startCombat`，第一回合開始之前）：掛上地獄狀態，第一關再加紫霧倒數 */
export function initHell(cs: CombatState, act: 1 | 2 | 3): void {
  cs.hell = { act };
  const enc = encounterById[cs.encounterId];
  if (act === 1) {
    cs.hell.miasmaLeft = MIASMA_TURNS[enc?.pool === '塔主' ? 'boss' : enc?.pool === '大魔物' ? 'elite' : 'normal'];
    return;
  }
  // 關主的第一形態自己帶紫霧（魔源「紫霧之繭」）：用遭遇表上的魔物資料判斷，不依賴場上的魔物已經建好
  if (enc?.enemies.some((id) => enemyById[id]?.hellMech?.includes('miasma'))) cs.hell.miasmaLeft = SOURCE_MIASMA_TURNS;
}

// ===== 關主的形態機制：關數給的 ∪ 當下形態自己帶的 =====

/** 這隻魔物當下這個形態額外開的機制：還沒換形態看本體資料，換過看那個階段。沒標＝undefined */
export function formMechs(e: EnemyCombat): readonly HellMech[] | undefined {
  const d = enemyById[e.enemyId];
  return e.phase > 0 ? d?.phases?.[e.phase - 1]?.hellMech : d?.hellMech;
}

const ACT_MECH: Record<1 | 2 | 3, HellMech> = { 1: 'miasma', 2: 'chaos', 3: 'cunning' };

/**
 * 這一場現在有沒有這種機制：所在關數給的（第一關快、第二關亂、第三關狡猾），加上場上活著的魔物當下形態額外開的。
 * 一般難度（`cs.hell` 沒有）恆為 false，連場上的魔物都不看。
 */
export function mechActive(cs: CombatState, m: HellMech): boolean {
  const h = cs.hell;
  if (!h) return false;
  if (ACT_MECH[h.act] === m) return true;
  return cs.enemies.some((e) => !e.dead && !e.escaped && formMechs(e)?.includes(m) === true);
}

const phaseOf = (e: EnemyCombat): EnemyPhase | undefined => enemyById[e.enemyId]?.phases?.[e.phase - 1];

/** 關主換形態（`damageEnemy` 換血條、`checkPhase` 換門檻階段，已經 `phase += 1` 之後叫）：紫霧跟著新形態開或關 */
export function onHellFormChange(cs: CombatState, e: EnemyCombat): void {
  const h = cs.hell;
  const mech = formMechs(e);
  if (!h || !mech) return;
  const ph = phaseOf(e);
  if (ph?.doom) h.doom = ph.doom.turns;
  if (ph?.dispel) dispelBuffs(cs, ph.dispel);
  if (mech.includes('miasma')) {
    h.miasmaLeft = SOURCE_MIASMA_TURNS;   // 真身重新起算，跟第一形態同一個回合數
    log(cs, '紫霧又聚攏了：{n} 回合後魔物爪力暴增', { n: SOURCE_MIASMA_TURNS });
  } else if (h.miasmaLeft !== undefined && h.act !== 1) {
    delete h.miasmaLeft;
    log(cs, '紫霧散開了：魔物不再每輪加爪力，你的抽牌也回到正常');
  }
}

/**
 * 每一輪結束呼叫一次（`finishEnemyTurn`，換回玩家回合之前）。
 * 倒數還沒歸零就減 1；減到 0 的那一輪寫一行戰報，**而且那一輪就先加一次爪力**（跟「這一輪起少抽 1 張」同一拍，
 * 玩家看到「紫霧漫滿」的同時就吃到），之後每一輪再各加一次（累加）。
 */
export function miasmaTick(cs: CombatState): void {
  const h = cs.hell;
  if (!h) return;
  doomTick(cs, h);
  if (h.miasmaLeft === undefined) return;
  const claw = miasmaClaw(cs);
  if (h.miasmaLeft > 0) {
    h.miasmaLeft -= 1;
    if (h.miasmaLeft > 0) return;
    log(cs, '紫霧漫滿了！魔物全體爪力 +{n}，之後每一輪都再加；你每回合少抽 1 張牌', { n: claw });
  }
  for (const e of cs.enemies) if (!e.dead) addStatus(e, '爪力', claw);
}

/**
 * 封印反噬：每位玩家身上的增益（`DEBUFFS` 以外的狀態：爪力、貓步、隱身、反彈、潛水、鐵布衫；護甲不算，
 * 縮殼、飛行、鱗甲、不壞身只會掛在魔物身上）層數打散 `ratio`（0.5＝留一半、無條件捨去）；真的打散了東西才寫戰報
 */
function dispelBuffs(cs: CombatState, ratio: number): void {
  let hit = false;
  for (const p of cs.players) for (const s of Object.keys(p.statuses) as StatusName[]) {
    if (DEBUFFS.includes(s)) continue;
    const n = p.statuses[s]!;   // 身上有的狀態層數一定大於 0（`addStatus` 歸零就刪）
    addStatus(p, s, -Math.ceil(n * ratio));
    hit = true;
  }
  if (hit) log(cs, '封印反噬：增益被打散了');
}

/**
 * 魔源真身的滅世倒數（每輪結束跟紫霧同一拍）：減到 0 的那一輪，把牠頭上的下一動換成滅世（意圖、電腦都讀 `e.move`，數字照實顯示）；
 * 放完的下一輪重新起算，所以兩次滅世相隔 `turns` 輪。
 */
function doomTick(cs: CombatState, h: HellState): void {
  if (h.doom === undefined) return;
  for (const e of cs.enemies) {
    const d = e.dead ? undefined : phaseOf(e)?.doom;
    if (!d) continue;
    if (h.doom > 0 ? --h.doom : (h.doom = d.turns - 1)) return;
    e.move = d.move;
    log(cs, '{e}蓄滿了力', { e: E(e) });
    return;
  }
}

/** 抽牌要少幾張：紫霧歸零回 1（固定、不累加），否則 0 */
export function hellDrawPenalty(cs: CombatState): number {
  return cs.hell?.miasmaLeft === 0 ? 1 : 0;
}

// ===== 第二關「亂」：偷牌、封牌 =====

/** 這個座位的玩家：偷牌的原主（連線兩位、單機一位；座位不存在回 undefined） */
const seatOf = (cs: CombatState, seat: number): PlayerCombat | undefined => cs.players[seat];

/** 紀錄裡的「你」：單機寫你，連線寫名字（跟 `stepEnemyTurn` 的震散紀錄同一個規矩） */
const multi = (cs: CombatState): boolean => cs.players.length > 1;

/** 從一位玩家的手牌隨機拿走一張，放進這隻魔物身上；回拿到的牌（手牌空就沒有） */
function takeFromHand(cs: CombatState, e: EnemyCombat, p: PlayerCombat): boolean {
  if (p.hand.length === 0) return false;
  const card = p.hand.splice(cs.rng.int(0, p.hand.length - 1), 1)[0]!;
  p.retained = p.retained.filter((u) => u !== card.uid);
  (e.stolenCards ??= []).push({ seat: p.seat, card });
  log(cs, multi(cs) ? '{e}順走了{who}的「{card}」' : '{e}順走了你的「{card}」', { e: E(e), who: H(p), card: { card: card.cardId, hero: p.hero, up: card.upgraded } });
  return true;
}

/**
 * 偷牌：從 `victim`（這一招瞄準的那位，跟偷小魚乾同一個判準）的手牌隨機拿 n 張。
 *
 * 魔物出手時玩家的手牌早在回合結束時棄光了（保留的牌除外），所以手上拿不到的張數先記成待偷，
 * 等那一位下一手牌抽好再拿（見 `resolveStealPending`）。倒下的那位不偷。
 */
export function stealCards(cs: CombatState, e: EnemyCombat, victim: PlayerCombat, n: number): void {
  if (victim.down) return;
  let left = n;
  while (left > 0 && takeFromHand(cs, e, victim)) left -= 1;
  if (left > 0) (e.stealPending ??= []).push({ seat: victim.seat, n: left });
}

/** 一位玩家的新手牌抽好之後呼叫（`startSeatTurn`）：兌現所有魔物記著的待偷張數 */
export function resolveStealPending(cs: CombatState, p: PlayerCombat): void {
  for (const e of cs.enemies) {
    if (!e.stealPending) continue;
    if (e.dead) { delete e.stealPending; continue; }
    const mine = e.stealPending.filter((x) => x.seat === p.seat);
    if (mine.length === 0) continue;
    e.stealPending = e.stealPending.filter((x) => x.seat !== p.seat);
    if (e.stealPending.length === 0) delete e.stealPending;
    if (p.down) continue;
    let left = mine.reduce((s, x) => s + x.n, 0);
    while (left > 0 && takeFromHand(cs, e, p)) left -= 1;   // 手牌拿光了就算了，不再往後拖
  }
}

/**
 * 把這隻身上的牌還給原主：手牌沒滿放回手牌，滿了（`HAND_LIMIT`）進棄牌堆。
 * 原主倒下或斷線也一樣還到那個座位的牌堆，不轉給別人。沒偷東西時什麼都不做。
 */
export function returnStolen(cs: CombatState, e: EnemyCombat): void {
  delete e.stealPending;
  const held = e.stolenCards;
  if (!held || held.length === 0) return;
  delete e.stolenCards;
  for (const { seat, card } of held) {
    const p = seatOf(cs, seat) ?? cs.player;
    const toHand = p.hand.length < HAND_LIMIT;
    if (toHand) p.hand.push(card); else p.discardPile.push(card);
    const arg = { card: card.cardId, hero: p.hero, up: card.upgraded };
    log(cs, multi(cs) ? (toHand ? '「{card}」回到{who}手上了' : '「{card}」回到{who}的棄牌堆了（手牌已滿）') : (toHand ? '「{card}」回到你手上了' : '「{card}」回到你的棄牌堆了（手牌已滿）'), { card: arg, who: H(p) });
  }
}

/**
 * 召喚者（目前只有地獄尾王魔源）倒下：牠召出來、還站著的魔物一併散去。
 * 走跟「消散」同一條路（`dead`＋`escaped`＋`faded`）：不算打倒、不掉戰利品、不觸發暴怒，偷來的牌還回去；
 * 最後的 `killEnemy` 接著 `markCombatWon` 就判贏。一般難度（`cs.hell` 沒有）與一般的召喚型關主完全不碰。
 */
export function dissipateSummons(cs: CombatState, summoner: EnemyCombat): void {
  if (!cs.hell) return;
  let any = false;
  for (const o of cs.enemies) {
    if (o.summonedBy !== summoner.enemyId || o.dead) continue;
    o.dead = true; o.escaped = true; o.faded = true;
    returnStolen(cs, o);
    any = true;
  }
  if (any) log(cs, '{e}倒下了，牠召來的魔物也跟著散去了', { e: E(summoner) });
}

/** 戰鬥收尾：每一隻身上的牌全部還回去（勝、敗、逃、事件，任何收法都走這裡；可以重複呼叫） */
export function returnAllStolen(cs: CombatState): void {
  for (const e of cs.enemies) returnStolen(cs, e);
}

/** 封牌：記下「下一個玩家回合封哪一類」。一般難度（`cs.hell` 沒有）什麼都不做 */
export function sealType(cs: CombatState, e: EnemyCombat, type: 'attack' | 'skill'): void {
  if (!cs.hell) return;
  cs.hell.sealNext = type;
  log(cs, type === 'attack' ? '{e}貼上封條：下一回合打不出攻擊牌' : '{e}貼上封條：下一回合打不出技能牌', { e: E(e) });
}

/** 玩家回合開始（`startPlayerTurn`，整場一次）：魔物上一輪貼的封條生效 */
export function startSeal(cs: CombatState): void {
  const h = cs.hell;
  if (!h) return;
  if (h.sealNext) { h.sealed = h.sealNext; delete h.sealNext; } else delete h.sealed;
}

/** 玩家回合結束（`beginEnemyTurn`）：封條只管那一個回合 */
export function endSeal(cs: CombatState): void {
  if (cs.hell) delete cs.hell.sealed;
}

/** 這類牌現在被封了嗎（`canPlay` 用）：能力牌從不被封 */
export function isSealed(cs: CombatState, type: CardType): 'attack' | 'skill' | null {
  const s = cs.hell?.sealed;
  return s && type === s ? s : null;
}

// ===== 第三關「狡猾」：看穿、嘲諷、同伴倒下暴怒 =====

/**
 * 這一場有沒有「狡猾」機制（看穿、嘲諷、暴怒）。**全部的判斷只問這一支**：地獄第三關，
 * 或場上有魔源在第三、四形態（`mechActive`：關數給的 ∪ 形態給的）。
 */
export function cunningActive(cs: CombatState): boolean {
  return mechActive(cs, 'cunning');
}

/** 玩家打出一張牌時記一筆（`playCard` 叫）。能力牌不記；連線兩位記在同一份。沒有狡猾機制就什麼都不做 */
export function recordPlay(cs: CombatState, type: CardType): void {
  if (!cunningActive(cs) || (type !== 'attack' && type !== 'skill')) return;
  const h = cs.hell!;
  const plays = (h.lastPlays ??= { attack: 0, skill: 0 });
  plays[type] += 1;
}

/**
 * 玩家回合開始（`startPlayerTurn`，整場一次）：看上一個玩家回合打得最多的那一類。
 * 攻擊多 → `'attack'`、技能多 → `'skill'`；平手、都沒出（含第一回合）→ 沒有（欄位刪掉，等同 `null`）。算完就清掉統計，
 * 所以只看**這場戰鬥的上一回合**。不擲骰。
 */
export function computeSeeThrough(cs: CombatState): void {
  if (!cunningActive(cs)) return;
  const h = cs.hell!;
  const p = h.lastPlays;
  delete h.lastPlays;
  const seen = !p || p.attack === p.skill ? null : p.attack > p.skill ? 'attack' : 'skill';
  if (seen) h.seeThrough = seen; else delete h.seeThrough;   // 沒有被看穿就不留欄位（`cs.hell` 維持 `{ act: 3 }`）
}

/** 玩家回合結束（`beginEnemyTurn`）：看穿只管那一個玩家回合 */
export function endSeeThrough(cs: CombatState): void {
  if (cs.hell) delete cs.hell.seeThrough;
}

/** 這一類牌現在被看穿了嗎：被看穿回 0.5，否則 1（數字怎麼取整看 `seeThroughAmount`） */
export function seeThroughScale(cs: CombatState, type: 'attack' | 'skill'): number {
  return cs.hell?.seeThrough === type ? 0.5 : 1;
}

/** 套上看穿：被看穿的那類減半，無條件捨去、最少 1（0 維持 0）。沒被看穿原樣回傳 */
export function seeThroughAmount(cs: CombatState, type: 'attack' | 'skill', n: number): number {
  if (n <= 0 || seeThroughScale(cs, type) === 1) return n;
  return halveSeen(n);
}
function halveSeen(n: number): number { return n <= 0 ? n : Math.max(1, Math.floor(n * 0.5)); }

function halveEffectDamage(fx: Effect): Effect {
  switch (fx.kind) {
    case 'damage': case 'damageRamp': case 'damageScatter': return { ...fx, amount: halveSeen(fx.amount) };
    case 'damageRandom': return { ...fx, min: halveSeen(fx.min), max: halveSeen(fx.max) };
    default: return fx;
  }
}
/**
 * 被看穿（攻擊）時牌面該印的樣子：攻擊牌上寫死的傷害數字照 `seeThroughAmount` 的取整減半（牌面不含爪力，所以只減牌上的數字）。
 * 只動畫面用的複本，不碰牌表；爪力、倍傷等執行時才知道的量仍由引擎算（傷害預覽走引擎）。
 */
export function seenAttackDef(def: CardDef): CardDef {
  if (def.type !== 'attack') return def;
  return {
    ...def,
    effects: def.effects.map(halveEffectDamage),
    upgrade: def.upgrade.effects ? { ...def.upgrade, effects: def.upgrade.effects.map(halveEffectDamage) } : def.upgrade,
  };
}

/** 現在誰在嘲諷：活著、沒逃走、打得到的第一隻（照魔物順序）。沒有回 undefined */
export function tauntingEnemy(cs: CombatState): EnemyCombat | undefined {
  if (!cunningActive(cs)) return undefined;   // 資料就算混進別的關，也要過狡猾這道閘
  return cs.enemies.find((e) => enemyById[e.enemyId]?.taunt && !e.dead && !e.escaped && e.invulnIn <= 0);
}

/**
 * 單體攻擊牌的目標改寫（`playCard` 叫）：有人嘲諷、而且點的是別隻，就改打嘲諷的並留一行紀錄。
 * 回改寫後的目標號碼；不用改就原樣回。全體、隨機挑目標、忍具不走這裡。
 */
export function redirectToTaunter(cs: CombatState, targetUid: number | undefined): number | undefined {
  if (targetUid === undefined) return targetUid;
  const t = tauntingEnemy(cs);
  if (!t || t.uid === targetUid) return targetUid;
  log(cs, '{e}出聲嘲諷，這一下改打牠', { e: E(t) });
  return t.uid;
}

/** 有魔物被打倒時叫（`killEnemy`）：場上帶「同伴倒下暴怒」的各加爪力 */
export function enrageOnAllyDeath(cs: CombatState, dead: EnemyCombat): void {
  if (!cunningActive(cs)) return;
  for (const o of cs.enemies) {
    const n = enemyById[o.enemyId]?.enrageOnAllyDeath;
    if (!n || o === dead || o.dead || o.escaped) continue;
    addStatus(o, '爪力', n);
    log(cs, '{e}看著同伴倒下，暴怒了！爪力 +{n}', { e: E(o), n });
  }
}
