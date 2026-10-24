/**
 * 地獄（難度 6）劇情接線（2026-10-24，使用者核可的稿子逐字照抄）：塔頂段、結局開頭與交代、連線版。
 * 難度 1～5 的結局與塔頂段要跟改之前逐字相同（`fixtures/vanilla_story_snapshot.json` 是改之前的指紋）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import snapshot from './fixtures/vanilla_story_snapshot.json';
import APP_RAW from '../../src/ui/app.ts?raw';
import { deckLeaning, dialogue, qiuqiuLineOk, feifeiLineOk, setCoopStory, storyFor, victoryLinesFor, type DialogueLine } from '../../src/content/dialogue';
import { endingSlides } from '../../src/ui/storyslides';
import { starterDeckFor } from '../../src/content/cards';

const APP = APP_RAW.replace(/\r\n/g, '\n');
type H = 'ninja' | 'feifei' | 'dangdang' | 'fengfeng';
const HEROES: H[] = ['ninja', 'feifei', 'dangdang', 'fengfeng'];
const pairs: [H, H][] = [];
for (const a of HEROES) for (const b of HEROES) if (a < b) pairs.push([a, b]);
const coop = (partner: string | null): void => (setCoopStory as unknown as (x: unknown) => void)(partner ? { partner } : null);
afterEach(() => coop(null));
const tt = (ls: DialogueLine[]): string[] => ls.map((l) => `${l.speaker}：${l.text}`);

const HELL_TOP: Record<H, string[]> = {
  ninja: [
    '旁白：推開最上層的門，裡面沒有半個人影。地板裂開一道大縫，紫霧從底下一陣一陣往上湧。',
    '旁白：師父倒在裂縫邊，手裡攥著半截斷掉的注連繩。',
    '球球：師父！……還有呼吸喵。底下那個是什麼東西喵？',
    '旁白：裂縫深處亮起一顆紫色的心臟，一隻巨大的繭慢慢浮了上來。',
  ],
  feifei: [
    '旁白：推開最上層的門，菲菲先看見師兄。他擋在裂開的地板前，額頭擦破了；師父倒在他身後，手裡攥著半截斷掉的注連繩。',
    '菲菲：師兄！師父他……',
    '球球：師父只是昏過去了喵。師妹快退，底下有東西要上來了喵！',
    '菲菲：我不退。……每次叫我退的都是你，受傷的也都是你。',
    '旁白：裂縫深處亮起一顆紫色的心臟，一隻巨大的繭慢慢浮了上來。菲菲把師兄扶到師父身邊，從竹筒裡抽出三根針。',
    '菲菲：師兄，師父交給你。這次……換我先上。',
  ],
  dangdang: [
    '旁白：最上層的門半掩著。地板裂開一道大縫，師父倒在裂縫邊，菲菲跪著替球球壓住傷口。紫霧從縫裡一陣一陣往上湧。',
    '球球：噹噹？你怎麼也上來了喵？',
    '噹噹：我來了。門補好了，換村貓守。',
    '菲菲：噹、噹噹……師父叫不醒，底下好像有東西在動。',
    '旁白：裂縫深處亮起一顆紫色的心臟，一隻巨大的繭慢慢浮了上來。噹噹把扣帶拉到最緊，擋到三人前面。',
    '噹噹：你們顧好師父。底下上來的，我先接。',
  ],
  fengfeng: [
    '旁白：菲菲扶著球球退到牆邊。師父倒在裂開的地板旁，手裡攥著半截斷掉的注連繩；紫霧正從縫裡往上湧。',
    '球球：封封，師父叫不醒喵！',
    '封封：繩子斷了一半，另一半在底下。你們顧著師父，別靠近裂縫。',
    '旁白：裂縫深處亮起一顆紫色的心臟，一隻巨大的繭慢慢浮了上來。封封拔劍，站到裂縫前。',
  ],
};
const HELL_TOP_COOP = [
  '旁白：推開最上層的門，地板裂開一道大縫，紫霧從底下一陣一陣往上湧。',
  '旁白：師父倒在裂縫邊，手裡攥著半截斷掉的注連繩，怎麼叫都叫不醒。',
  '旁白：裂縫深處亮起一顆紫色的心臟，一隻巨大的繭慢慢浮了上來。兩人對看一眼，一起站到師父前面。',
];
const ACCOUNT = '原來塔底的封印早就斷了。師父一個人進來想把魔源封回去，反被魔氣纏上，才會倒在這裡。現在注連繩接回去了，紫霧散了，塔也不會再長了。';
const OPENING: Record<H, string> = {
  ninja: '斷掉的注連繩接回去了，地板的裂縫慢慢合上。倒在一旁的師父咳了兩聲，睜開眼睛。',
  feifei: '斷掉的注連繩接回去，裂縫慢慢合上。師父咳了兩聲，睜開眼睛。塔頂另一端，球球靠著牆抬起頭。菲菲看看師父，又看看師兄，握針的手終於垂了下來。',
  dangdang: '注連繩接了回去，裂縫合上，紫霧一下子散了。師父撐著地坐起來，噹噹這才把架著的手臂放下。',
  fengfeng: '注連繩接了回去，裂縫合上，紫霧散了。師父睜開眼睛，看著封封還舉著的劍。',
};
const REPLY: Record<H, string> = {
  ninja: '師父，你終於醒了喵。',
  feifei: '師父，您一個人跑來這裡……連我都不說。師兄也是，連個消息都沒有。',
  dangdang: '您醒了。……下次要封什麼東西，先叫上我。',
  fengfeng: '您醒了。先坐下，我把劍收好。',
};
const COOP_OPENING = OPENING.ninja;
const deckOf = (h: H, extra: string[] = []): string[] => [...starterDeckFor(h), ...extra];

describe('地獄塔頂段', () => {
  it.each(HEROES)('單人 %s：地獄塔頂段逐字等於核可稿', (h) => {
    coop(null);
    expect(tt(storyFor(h).hellTopScene)).toEqual(HELL_TOP[h]);
  });

  it.each(pairs.flatMap(([a, b]) => [[a, b], [b, a]] as [H, H][]))('連線 %s＋%s：只用旁白的連線版', (me, other) => {
    coop(other);
    expect(tt(storyFor(me).hellTopScene)).toEqual(HELL_TOP_COOP);
  });

  it.each(HEROES)('同角色雙人 %s：照單人那份（跟結局同一個規矩）', (h) => {
    coop(h);
    expect(tt(storyFor(h).hellTopScene)).toEqual(HELL_TOP[h]);
  });

  it('球球那句都以「喵」結尾、菲菲不以喵結尾（核可稿的口癖規矩）', () => {
    for (const h of HEROES) {
      for (const l of storyFor(h).hellTopScene) {
        if (l.speaker === '球球') expect(qiuqiuLineOk(l.text), l.text).toBe(true);
        if (l.speaker === '菲菲') expect(feifeiLineOk(l.text), l.text).toBe(true);
        if (l.speaker === '旁白' || l.speaker === '噹噹' || l.speaker === '封封') expect(l.text, l.text).not.toMatch(/喵[！？。…～]*$/u);
      }
    }
  });

  it('app.ts：地獄播 hellTopScene（不配原版的圖）、難度 1～5 照舊播 topScene', () => {
    expect(APP).toContain('const hell = runMods(run).hellMode;');
    expect(APP).toContain('const top = topStory ? (hell ? topStory.hellTopScene : topStory.topScene) : [];');
    expect(APP).toContain('const topSlides = hell ? [] : topSceneSlides(localHero());');
    expect(APP).toContain('storyFor(localHero())');
    expect(APP).toContain('this.playOnce(`topScene:${run.act}`, top, playBoss, STORY_LITERAL, topSlides)');
  });
});

describe('地獄結局（單人）', () => {
  const decks = (h: H): Record<string, string[]> => ({
    plain: deckOf(h),
    strength: deckOf(h, Array<string>(8).fill(h === 'ninja' ? 'fengyin' : h === 'feifei' ? 'feifei_tieqiang' : 'sanjo')),
  });
  it.each(HEROES)('%s：開頭、交代、重出江湖、主角回話逐字，沒有打法旁白，切點還在', (h) => {
    coop(null);
    for (const [name, deck] of Object.entries(decks(h))) {
      const v = victoryLinesFor(deck, 6, h);
      expect(v[0], `${name} 開頭`).toMatchObject({ speaker: '旁白', text: OPENING[h] });
      expect(v[1], `${name} 交代`).toEqual({ speaker: '旁白', text: ACCOUNT });
      expect(v[2], `${name} 師父`).toMatchObject({ speaker: '大俠貓', text: '重出江湖。' });
      expect(v[3]!.text, `${name} 回話`).toBe(REPLY[h]);
      expect(v[3]!.speaker).not.toBe('旁白');
      // 沒有打法旁白
      const narrs = new Set(Object.values(storyFor(h).victoryNarration));
      expect(v.filter((l) => narrs.has(l.text)), name).toEqual([]);
      // 切點留著、而且跟難度 5 同一句
      const cut = v.filter((l) => l.slideBreak);
      const cut5 = victoryLinesFor(deck, 5, h).filter((l) => l.slideBreak);
      expect(cut.length).toBe(1);
      expect(cut[0]!.text).toBe(cut5[0]!.text);
      // 其後的句子（相擁、切點、回村、尾聲）與難度 5 逐句相同（難度 5 的打法旁白除外）
      const v5 = victoryLinesFor(deck, 5, h).filter((l) => !narrs.has(l.text));
      expect(tt(v.slice(4)), name).toEqual(tt(v5.slice(3)));
    }
  });

  it('封封：回話保留 narrationAfter 標記（打法插句的錨點）', () => {
    const v = victoryLinesFor(deckOf('fengfeng'), 6, 'fengfeng');
    expect(v[3]!.narrationAfter).toBe(true);
  });

  it('球球的師父那句在 DAXIA 標題裡、地獄每位都一樣', () => {
    for (const h of HEROES) expect(victoryLinesFor(deckOf(h), 6, h).find((l) => l.speaker === '大俠貓')!.text).toBe('重出江湖。');
    expect(dialogue.hellMasterFirstWords).toBe('重出江湖。');
  });

  it('帶伏筆旁白（ctx）時切點與尾聲仍在、交代仍是第 2 句', () => {
    for (const h of HEROES) {
      const v = victoryLinesFor(deckOf(h), 6, h, { defeatsBefore: 4, relics: [] });
      expect(v[1]!.text).toBe(ACCOUNT);
      expect(v.filter((l) => l.slideBreak).length).toBe(1);
      expect(v[v.length - 1]!.text).toBe(storyFor(h).hardModeEpilogue);
    }
  });

  it('難度 5 沒有交代那句也沒有地獄開頭', () => {
    for (const h of HEROES) {
      const v = victoryLinesFor(deckOf(h), 5, h).map((l) => l.text);
      expect(v).not.toContain(ACCOUNT);
      expect(v).not.toContain(OPENING[h]);
      expect(v).not.toContain('重出江湖。');
    }
  });
});

/** 連線六組搭檔的主角回話：[難度 1～5 原句, 地獄版]（原句假設兩人切磋收場，地獄是師父倒在裂縫邊醒來） */
const COOP_REPLY: Record<string, [string, string]> = {
  'dangdang+ninja': ['你終於認得我了喵。', '師父，你終於醒了喵。'],
  'feifei+ninja': ['師父，這又不是切磋……您剛才連我都不認得了。我跟師兄喊了您一路呢。', '師父，您一個人跑來這裡……連我都不說。'],
  'dangdang+feifei': ['您認得我了，對不對？', '師父，您醒了，對不對？'],
  'fengfeng+ninja': ['不是切磋，我是來找你的喵。', '師父，我是來找你的喵。'],
  'feifei+fengfeng': ['您認得我們了，對不對？', '師父，您醒了，對不對？'],
  'dangdang+fengfeng': ['終於肯停了。我的手都快抬不起來。', '您醒了。……下次要封什麼東西，先叫上我。'],
};

describe('地獄結局（連線）', () => {
  it.each(pairs.flatMap(([a, b]) => [[a, b], [b, a]] as [H, H][]))('%s＋%s：主角回話在地獄換新句、交代仍在、難度 5 是原句', (me, other) => {
    coop(other);
    const [oldLine, newLine] = COOP_REPLY[[me, other].sort().join('+')]!;
    const deck = deckOf(me);
    const v = victoryLinesFor(deck, 6, me);
    const v5 = victoryLinesFor(deck, 5, me);
    expect(v[1]).toEqual({ speaker: '旁白', text: ACCOUNT });
    expect(v[3]!.text).toBe(newLine);
    expect(v5[2]!.text).toBe(oldLine);
    expect(v.map((l) => l.text)).not.toContain(oldLine);
    expect(v5.map((l) => l.text)).not.toContain(newLine);
    expect(v[3]!.speaker).toBe(v5[2]!.speaker);
  });

  it.each(pairs.flatMap(([a, b]) => [[a, b], [b, a]] as [H, H][]))('%s＋%s：共用開頭、交代在第 2 句、重出江湖、其後與難度 5 逐句相同、圖的切點完好', (me, other) => {
    coop(other);
    const deck = deckOf(me);
    const v = victoryLinesFor(deck, 6, me);
    const v5 = victoryLinesFor(deck, 5, me);
    expect(v[0]).toMatchObject({ speaker: '旁白', text: COOP_OPENING });
    expect(v[1]).toEqual({ speaker: '旁白', text: ACCOUNT });
    expect(v[2]).toMatchObject({ speaker: '大俠貓', text: '重出江湖。' });
    expect(v[3]!.text).toBe(COOP_REPLY[pairs.find(([a, b]) => (a === me && b === other) || (a === other && b === me))!.join('+')]![1]);   // 主角回話換成地獄版（2026-10-24 核可）
    expect(tt(v.slice(4))).toEqual(tt(v5.slice(3)));       // 其後的句子照連線稿不動
    expect(v.length).toBe(v5.length + 1);
    // 圖的切點：難度 6 跟難度 5 分到的張數一樣、每張都有句子、句子合起來等於整段結局、切點標記還在原本那句
    const s6 = endingSlides(me, deck, 6);
    const s5 = endingSlides(me, deck, 5);
    expect(s6.length).toBe(s5.length);
    expect(s6.length).toBeGreaterThan(0);
    for (const s of s6) expect(s.lines.length).toBeGreaterThan(0);
    expect(tt(s6.flatMap((s) => s.lines))).toEqual(tt(v));
    s6.slice(0, -1).forEach((s, i) => {
      expect(s.lines[s.lines.length - 1]!.slideBreak, `第 ${i + 1} 張最後一句是切點`).toBe(true);
      expect(s.lines[s.lines.length - 1]!.text).toBe(s5[i]!.lines[s5[i]!.lines.length - 1]!.text);
    });
  });
});

describe('難度 1～5 逐字不變（對改之前的指紋）', () => {
  const h1 = (x: unknown): string => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
  const snap = snapshot as { decks: Record<string, string[]>; cases: Record<string, string> };
  const ctxs = [undefined, { defeatsBefore: 4 }, { defeatsBefore: 0, relics: [] }] as const;
  const runAll = (partner: string | null, hero: H): [string, string][] => {
    coop(partner);
    const out: [string, string][] = [];
    for (const [dk, d] of Object.entries(snap.decks)) {
      const [dh, lean] = dk.split('|') as [H, string];
      if (dh !== hero) continue;
      expect(deckLeaning(d, hero), dk).toBe(lean);
      for (const diff of [1, 4, 5]) ctxs.forEach((c, ci) => out.push([`${partner ?? 'solo'}|${hero}|${lean}|${diff}|${ci}`, h1(victoryLinesFor(d, diff, hero, c))]));
    }
    const st = storyFor(hero);
    out.push([`${partner ?? 'solo'}|${hero}|story`, h1({ top: st.topScene, victory: st.victory, ep: st.hardModeEpilogue })]);
    return out;
  };
  const all: [string | null, H][] = [
    ...HEROES.map((h) => [null, h] as [null, H]),
    ...HEROES.flatMap((a) => HEROES.filter((b) => b !== a).map((b) => [b, a] as [H, H])),
    ...HEROES.map((h) => [h, h] as [H, H]),
  ];
  it('單人、連線、同角色雙人 × 各打法 × 難度 1／4／5 × 三種 ctx：victoryLinesFor 與塔頂段／結局原稿指紋全部一致', () => {
    let n = 0;
    for (const [partner, hero] of all) for (const [k, v] of runAll(partner, hero)) {
      expect(snap.cases[k], k).toBe(v);
      n += 1;
    }
    expect(n).toBe(Object.keys(snap.cases).length);
    expect(n).toBeGreaterThan(500);
  });
});
