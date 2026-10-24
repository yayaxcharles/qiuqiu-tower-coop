/*
 * 地獄（難度 6）新增台詞盤點（2026-10-24）：沿用 dump_lines.ts 的規則（真的跑 storyFor／lineFor／castLineFor，
 * 依（聲音角色, 最終中文）去重），但只列地獄才有的三塊——
 *   ①塔頂段（hellTopScene 裡的主角台詞，不含旁白、不含連線版）
 *   ②尾王魔源（hell_source）的開場、三次換形態、倒下，魔源與主角回話
 *   ③單人結局：主角回話（hellVictoryHead.reply）與師父那句「重出江湖。」
 * 不收旁白、魔物初見吐槽、隨機事件、連線雙人場景。
 *
 * 用法：
 *   node_modules\.bin\esbuild tools/voice/dump_lines_hell.ts --bundle --platform=node --format=esm --outfile=<暫存>/dump_hell.mjs
 *   node <暫存>/dump_hell.mjs > tools/voice/lines_zh_hell.json
 */
import {
  dialogue, storyFor, lineFor, castLineFor, setCoopStory, victoryLinesFor, type DialogueLine,
} from '../../src/content/dialogue';
import { HEROES, type Hero } from '../../src/engine/hero';

const HERO_KEY: Record<string, Hero> = { 球球: 'ninja', 菲菲: 'feifei', 噹噹: 'dangdang', 封封: 'fengfeng' };
const BOSS = 'hell_source';

interface Entry { speaker: string; text: string; ctx: string[] }
const out = new Map<string, Entry>();
function add(speaker: string, text: string, ctx: string): void {
  const k = `${speaker}|${text}`;
  const e = out.get(k);
  if (e) { if (!e.ctx.includes(ctx)) e.ctx.push(ctx); } else out.set(k, { speaker, text, ctx: [ctx] });
}

/** 字面播的過場：說話者照寫的（塔頂段、結局） */
function literal(name: string, hero: Hero, lines: DialogueLine[]): void {
  lines.forEach((l, i) => {
    if (l.speaker === '旁白') return;
    const k = HERO_KEY[l.speaker] ?? (l.speaker === '大俠貓' ? 'daxia' : null);
    if (!k) throw new Error(`未知說話者 ${l.speaker}`);
    add(k, l.text, `${hero}/${name}#${i}`);
  });
}

/** 走 playDialogue／bossPhaseTalk：球球的句子過 lineFor、其餘過 castLineFor；「塔主」＝魔源 */
function swapped(name: string, hero: Hero, lines: DialogueLine[]): void {
  lines.forEach((l, i) => {
    if (l.speaker === '旁白') return;
    const isHero = l.speaker === '球球';
    const text = isHero ? lineFor(hero, l.text) : castLineFor(hero, l.text);
    const k = isHero ? hero : l.speaker === '塔主' ? BOSS : null;
    if (!k) throw new Error(`未知說話者 ${l.speaker}`);
    add(k, text, `${hero}/${name}#${i}`);
  });
}

setCoopStory(null);
for (const hero of HEROES) {
  literal('hellTopScene', hero, storyFor(hero).hellTopScene);
  // 結局：難度 6 與難度 1 逐句比，新增的非旁白句（主角回話、師父「重出江湖。」）才算
  const base = new Set(victoryLinesFor([], 1, hero).map((l) => `${l.speaker}|${l.text}`));
  literal('hellVictory', hero, victoryLinesFor([], 6, hero).filter((l) => !base.has(`${l.speaker}|${l.text}`)));
  swapped('bossIntro', hero, dialogue.bossIntroById[BOSS]!);
  (dialogue.bossFormTalkById[BOSS] ?? []).forEach((ls, i) => swapped(`bossForm${i + 2}`, hero, ls));
  swapped('bossDefeat', hero, dialogue.bossDefeatById[BOSS]!);
}

process.stdout.write(JSON.stringify({ lines: [...out.values()] }, null, 1));
declare const process: { stdout: { write(s: string): void } };
