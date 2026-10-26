import { coopStoryKey, hasCoopScene, storyFor, victoryLinesFor, type DialogueLine } from '../content/dialogue';
import { FENGFENG_YARD_FIRST } from '../content/fengfeng-dialogue';
import type { VictoryCtx } from '../content/victory-echoes';
import type { Slide } from './slides';

/*
 * 劇情幻燈片「哪張圖配哪幾句」**只算一次**（2026-09-14 夜間稽核 中-5）。
 *
 * 原本切法寫在 `app.ts` 裡，除錯模式的「劇情」頁自己又抄了一份「一張圖配一句」——
 * 抄錯了：結局第二張配成「塔主：承讓。」、第一張只列一句（遊戲裡是四到六句）、
 * 菲菲第二關第三張少一句。頁首寫「圖旁邊就是它在遊戲裡配的台詞」，照著檢查反而被誤導。
 * 現在遊戲與除錯頁都叫這三支，看到的就是同一份。
 */

/**
 * 過關與結局的插圖要**依角色**（2026-09-12）。這幾張圖裡球球都是主角（相擁那張他就在正中央），
 * 沒生好她的那一份時回她的鍵就好——`slidesReady` 查不到會讓整段退回純對白，
 * 那正是要的行為：寧可少一段幻燈片，不要放別人的故事。
 */
function stillKey(hero: string | undefined, name: string): string {
  if (hero === 'feifei') return `bg/feifei_${name}`;
  if (hero === 'dangdang') return `bg/dangdang_${name}`;
  if (hero === 'fengfeng') return `bg/fengfeng_${name}`;
  return `bg/${name}`;
}

/**
 * 連線雙貓的劇情圖。鍵是 `coopStoryKey`（排序過的兩個角色），兩台機器配同一套圖。
 * 序章與結局是一到兩張：一張就整段配它；兩張就照台詞標的 `slideBreak` 切（切點不夠或切出空段就整段退回純對白）。
 * 沒寫的那一段（例如另外三組沒有塔頂那段台詞，就沒有 `top`）照舊退回純對白。
 *
 * 2026-09-20 只有封封三條有序章、塔頂、結局各一張，其他三組與封封的兩次過關都退回純對白；
 * 2026-09-23 補齊：球球＋菲菲、球球＋噹噹、噹噹＋菲菲各六張（序章 2、過關各 1、結局 2），
 * 封封三條補兩次過關各 1（`tools/gen_coop_story_art.py`，每張照那一段台詞畫）。
 */
type CoopStoryArt = { prologue: readonly string[]; act1?: string; act2?: string; top?: string; victory: readonly string[] };

const coopPairArt = (hero: string, partner: string): CoopStoryArt => {
  const k = (part: string): string => `bg/${hero}_coop_${partner}_${part}`;
  return { prologue: [k('prologue1'), k('prologue2')], act1: k('act1'), act2: k('act2'), victory: [k('victory1'), k('victory2')] };
};
const fengfengPairArt = (partner: string): CoopStoryArt => {
  const k = (part: string): string => `bg/fengfeng_coop_${partner}_${part}`;
  return { prologue: [k('prologue')], act1: k('act1'), act2: k('act2'), top: k('top'), victory: [k('victory')] };
};

const COOP_ART: Readonly<Record<string, CoopStoryArt>> = {
  'fengfeng+ninja': fengfengPairArt('ninja'),
  'feifei+fengfeng': fengfengPairArt('feifei'),
  'dangdang+fengfeng': fengfengPairArt('dangdang'),
  'feifei+ninja': coopPairArt('feifei', 'ninja'),
  'dangdang+ninja': coopPairArt('dangdang', 'ninja'),
  'dangdang+feifei': coopPairArt('dangdang', 'feifei'),
};

function coopArtFor(hero: string | undefined): CoopStoryArt | undefined {
  const key = coopStoryKey(hero);
  return key === null ? undefined : COOP_ART[key];
}

/** 照 `slideBreak` 把台詞分給這幾張圖（多出來的切點併進最後一張）；分不齊回空陣列＝退回純對白 */
function coopSlides(imgs: readonly string[], lines: DialogueLine[]): Slide[] {
  if (!lines.length) return [];
  const groups: DialogueLine[][] = [[]];
  for (const l of lines) {
    groups[groups.length - 1]!.push(l);
    if (l.slideBreak && groups.length < imgs.length) groups.push([]);
  }
  if (groups.length < imgs.length || groups.some((g) => g.length === 0)) return [];
  return imgs.map((img, i) => ({ img, lines: groups[i]! }));
}

/**
 * 序章：四張圖。**最後一張吃掉剩下的所有句子**。
 *
 * 球球的序章有五句、圖只有四張。2026-09-12 改成兩個角色共用寫法時每張都寫成 `slice(i, i + 1)`，
 * 第五句「我要把師父帶回家，也要把村裡的小魚乾全部拿回來喵。」從那天起再也沒演過
 *（稽核 範圍外-2）。改回舊的做法：最後一張 `slice(3)`。
 */
export function prologueSlides(hero: string | undefined): Slide[] {
  const coopArt = coopArtFor(hero);
  if (coopArt) return coopSlides(coopArt.prologue, storyFor(hero).prologue);
  if (hasCoopScene(hero)) return [];
  const pro = storyFor(hero).prologue;
  // 第三張各家不同：球球是「師父衝進塔、他追上去」，菲菲是「三天過去，兩個都沒回來」，
  // 噹噹是「第三天，菲菲背著行囊來到門口」
  // 封封 2026-09-25 從五張併成四張：`fengfeng_story_p05` 跟 `still_tower` 幾乎同一個畫面，序章縮句後不再用（見 `fengfengPrologue` 的說明）
  const stills = hero === 'fengfeng'
    ? ['fengfeng_still_return', 'fengfeng_still_shop', 'fengfeng_still_meet', 'fengfeng_still_tower']
    : hero === 'feifei'
    ? ['feifei_still_teach', 'feifei_still_corrupt', 'feifei_still_wait', 'feifei_still_depart']
    : hero === 'dangdang'
      ? ['dangdang_still_shop', 'dangdang_still_gate', 'dangdang_still_send', 'dangdang_still_depart']
      : ['still_teach', 'still_corrupt', 'still_rush', 'still_depart'];
  /*
   * **標了切點就照切點分**（2026-09-17 為噹噹加的）。
   *
   * 原本一律「一張圖配一句、最後一張吃掉剩下的」。球球五句、菲菲四句，那樣剛好；
   * 噹噹的序章有十八句（他那一夜先守村口、第三天才上塔），照舊切法會變成
   * 前三張各一句、第十五句全部擠在最後一張。
   * 球球與菲菲的序章沒有標任何切點，走的還是原本那一條，一個字都沒動。
   */
  if (pro.some((l) => l.slideBreak)) {
    const groups = groupsAtBreaks(pro, stills.length);
    return groups ? stills.map((k, i) => ({ img: `bg/${k}`, lines: groups[i]! })) : [];
  }
  return stills.map((k, i) => ({ img: `bg/${k}`, lines: pro.slice(i, i === stills.length - 1 ? undefined : i + 1) }));
}

/** 照 `slideBreak` 切成 `n` 段；切點不夠、或有一段是空的就回 null（呼叫端整段不演） */
function groupsAtBreaks(lines: DialogueLine[], n: number): DialogueLine[][] | null {
  const groups: DialogueLine[][] = [[]];
  for (const l of lines) {
    groups[groups.length - 1]!.push(l);
    if (l.slideBreak && groups.length < n) groups.push([]);
  }
  /*
   * **切點不夠就整段不演**（稽核 2026-09-17 高-3）。
   *
   * 連線那兩套共用場景的序章只標了一個切點，卻要配四張圖：後兩張拿到空陣列、
   * 安靜地不出現，而前兩段配到的是**單人劇本**那四張圖（師父在教球球、師父被魔氣控制），
   * 講的卻是「村口的門剛關上」。`stillKey` 的檔頭自己寫著
   *「寧可少一段幻燈片，不要放別人的故事」——這裡回空陣列，`slidesReady` 就會讓整段退回純對白。
   */
  if (groups.length < n || groups.some((g) => g.length === 0)) return null;
  return groups;
}

/** 過關：三句台詞配三張圖，最後一張吃掉剩下的（她第二關比圖多一句） */
/*
 * 沒有專屬美術的連線場景仍退回純對白（2026-09-17 稽核 中-3）。
 *
 * 不擋的話會這樣：這兩支走的是 `stillKey(hero, …)`，回的是**單人版**的鍵，
 * 而那些圖全都在倉裡，於是 `slidesReady` 回 true，兩隻貓的對話就被鋪到
 * 「一隻貓自己站在那裡」的圖上——第一關過關詞寫「球球在樓梯旁找到糧箱，抱起來晃了晃」，
 * 圖裡根本沒有球球。`stillKey` 的檔頭訂過規矩：**寧可少一段幻燈片，不要放別人的故事。**
 * 有專屬圖的連線配對（`COOP_ART`，2026-09-23 六組都有了）整段配那一張；沒有的仍回退。
 */
export function actClearSlides(hero: string | undefined, act: number): Slide[] {
  const story = storyFor(hero);
  const lines = act === 1 ? story.actClear1 : story.actClear2;
  const coopImg = act === 1 ? coopArtFor(hero)?.act1 : coopArtFor(hero)?.act2;
  if (coopImg) return coopSlides([coopImg], lines);
  if (hasCoopScene(hero)) return [];
  const names = act === 1
    ? ['still_act1_stairs', 'still_act1_fish', 'still_act1_climb']
    : ['still_act2_smoke', 'still_act2_voice', 'still_act2_moonstairs'];
  // 標了切點就照切點分（2026-09-23 稽核 中-4）：封封第二關六句三張圖，照舊切法噹噹那幾句全擠在他獨自一人的那張
  if (lines.some((l) => l.slideBreak)) {
    const groups = groupsAtBreaks(lines, names.length);
    return groups ? names.map((n, i) => ({ img: stillKey(hero, n), lines: groups[i]! })) : [];
  }
  return names.map((n, i) => ({ img: stillKey(hero, n), lines: lines.slice(i, i === names.length - 1 ? undefined : i + 1) }));
}

/** 塔頂關主戰前的合作場景；單人路線沒有對應幻燈片，仍使用既有文字。 */
export function topSceneSlides(hero: string | undefined): Slide[] {
  const coopArt = coopArtFor(hero);
  const lines = storyFor(hero).topScene;
  if (!coopArt && hero === 'fengfeng') {
    return lines.length ? [{ img: 'bg/fengfeng_story_top', lines }] : [];
  }
  if (!coopArt?.top) return [];
  return coopSlides([coopArt.top], lines);
}

/**
 * 結局：兩張圖。第一張（相擁）放到標了 `slideBreak` 的那句為止，之後的（回家路、難度旁白）配第二張。
 * **不要改回比對內文**：原本寫 `includes('撲進')`，菲菲的結局沒那兩個字，
 * 切點被夾成 1，她的相擁那句就配到「回家路」的圖上（2026-09-12 稽核 中-1）。
 */
/*
 * 沒有專屬美術的連線場景仍退回純對白（2026-09-17 稽核 中-3）。
 *
 * 不擋的話會這樣：這兩支走的是 `stillKey(hero, …)`，回的是**單人版**的鍵，
 * 而那些圖全都在倉裡，於是 `slidesReady` 回 true，兩隻貓的對話就被鋪到
 * 「一隻貓自己站在那裡」的圖上——第一關過關詞寫「球球在樓梯旁找到糧箱，抱起來晃了晃」，
 * 圖裡根本沒有球球。`stillKey` 的檔頭訂過規矩：**寧可少一段幻燈片，不要放別人的故事。**
 * 連線配對的結局圖與序章、塔頂圖同一路由（`COOP_ART`），不借用單人圖。
 */
// `ctx`＝這一局挑伏筆旁白要的狀況（2026-09-25，見 `victory-echoes.ts`）；除錯頁不傳，照舊沒有伏筆
export function endingSlides(hero: string | undefined, deckIds: string[], difficulty: number, ctx?: VictoryCtx): Slide[] {
  const vic = victoryLinesFor(deckIds, difficulty, hero, ctx);
  const coopArt = coopArtFor(hero);
  if (coopArt) {
    const s = coopSlides(coopArt.victory, vic);
    // 地獄：第一張相擁圖前面先插「師父被魔氣纏住」那張（見 `hellWakeEnd`）。球球＋菲菲借菲菲版（圖裡兩人都在，10-25 使用者裁定），
    // 其他五組 10-25 補了各自的雙人版
    const corrupt = difficulty >= 6 ? HELL_CORRUPT_COOP[coopStoryKey(hero) ?? ''] : undefined;
    const at = s[0] ? hellWakeEnd(s[0].lines) : -1;
    if (corrupt && at > 0 && at < s[0]!.lines.length) {
      return [{ img: `bg/${corrupt}`, lines: s[0]!.lines.slice(0, at) }, { img: s[0]!.img, lines: s[0]!.lines.slice(at) }, ...s.slice(1)];
    }
    return s;
  }
  if (hasCoopScene(hero)) return [];
  const cut = Math.max(1, vic.findIndex((l) => l.slideBreak) + 1);
  /*
   * 地獄（2026-10-24 使用者裁定 B）：開頭幾句（注連繩接回去、師父睜開眼睛、重出江湖）師父才剛醒、人還跪在裂縫邊，
   * 「抱在一起」那張要等到師父動手抱人那句才對得上，前幾句先配「師父被魔氣纏住」那張。
   * 球球、菲菲用既有圖；噹噹、封封 10-25 補了各自的版本。
   */
  const at = difficulty >= 6 ? hellWakeEnd(vic) : -1;
  const corrupt = HELL_CORRUPT_SOLO[hero ?? 'ninja'];
  const wake: Slide[] = corrupt && at > 0 && at < cut ? [{ img: `bg/${corrupt}`, lines: vic.slice(0, at) }] : [];
  const from = wake.length ? at : 0;
  if (hero === 'fengfeng') {
    // 封封結局最後一段是幾天後的院子練劍（EP01），在村口熱湯那張之後，自己配一張圖。
    // 打法插句、伏筆旁白都插在前面（見 `victoryLinesFor`），院子那段的起點要照第一句找，不能寫死第 10 句；
    // 那一句收在具名常數裡（2026-09-23 稽核 低-6：原本寫 `victory[10]`，結局多一句少一句就切到別人的話上）
    const found = vic.findIndex((l) => l.text === FENGFENG_YARD_FIRST);
    const yardStart = found > 0 ? found : vic.length;
    return [...wake, ...['still_embrace', 'still_home', 'story_ep01'].map((n, i) => ({
      img: stillKey(hero, n),
      lines: i === 0 ? vic.slice(from, cut) : i === 1 ? vic.slice(cut, yardStart) : vic.slice(yardStart),
    }))];
  }
  return [...wake, ...['still_embrace', 'still_home'].map((n, i) => ({
    img: stillKey(hero, n), lines: i === 0 ? vic.slice(from, cut) : vic.slice(cut),
  }))];
}

/**
 * 地獄塔頂段（`hellTopScene`：師父倒在裂縫邊、魔源的繭浮上來）一整段配一張（2026-10-25 補圖）。
 * 單人照角色；不同角色連線照 `coopStoryKey`（連線版是只有旁白的那份，圖畫兩人並肩擋在師父前面）；同角色雙人走單人那份。
 */
export function hellTopSceneSlides(hero: string | undefined): Slide[] {
  const lines = storyFor(hero).hellTopScene;
  if (!lines.length) return [];
  const key = coopStoryKey(hero);
  const img = key !== null ? HELL_TOP_COOP[key] : HELL_TOP_SOLO[hero ?? 'ninja'];
  return img ? [{ img: `bg/${img}`, lines }] : [];
}
const HELL_TOP_SOLO: Readonly<Record<string, string>> = {
  ninja: 'still_hell_top', feifei: 'feifei_still_hell_top', dangdang: 'dangdang_still_hell_top', fengfeng: 'fengfeng_still_hell_top',
};
const HELL_TOP_COOP: Readonly<Record<string, string>> = {
  'feifei+ninja': 'feifei_coop_ninja_hell_top',
  'dangdang+ninja': 'dangdang_coop_ninja_hell_top',
  'dangdang+feifei': 'dangdang_coop_feifei_hell_top',
  'fengfeng+ninja': 'fengfeng_coop_ninja_hell_top',
  'feifei+fengfeng': 'fengfeng_coop_feifei_hell_top',
  'dangdang+fengfeng': 'fengfeng_coop_dangdang_hell_top',
};

/** 地獄結局「師父被魔氣纏住」那張（單人照角色、連線照 `coopStoryKey`）。同角色雙人走單人那份 */
const HELL_CORRUPT_SOLO: Readonly<Record<string, string>> = {
  ninja: 'still_corrupt', feifei: 'feifei_still_corrupt', dangdang: 'dangdang_still_corrupt', fengfeng: 'fengfeng_still_corrupt',
};
const HELL_CORRUPT_COOP: Readonly<Record<string, string>> = {
  'feifei+ninja': 'feifei_still_corrupt',
  'dangdang+ninja': 'dangdang_coop_ninja_corrupt',
  'dangdang+feifei': 'dangdang_coop_feifei_corrupt',
  'fengfeng+ninja': 'fengfeng_coop_ninja_corrupt',
  'feifei+fengfeng': 'fengfeng_coop_feifei_corrupt',
  'dangdang+fengfeng': 'fengfeng_coop_dangdang_corrupt',
};

/**
 * 地獄第三關關主門那一刻要先抓的兩張劇情圖：塔頂段那張＋結局開頭「師父被魔氣纏住」那張（2026-10-26 稽核 4）。
 * 照這一局的角色／組合只回用得到的，鍵跟 `hellTopSceneSlides`、`endingSlides` 挑圖走同一組表（測試對過）。
 */
export function hellStoryImgKeys(hero: string | undefined): string[] {
  const key = coopStoryKey(hero);
  const top = key !== null ? HELL_TOP_COOP[key] : HELL_TOP_SOLO[hero ?? 'ninja'];
  const corrupt = key !== null ? HELL_CORRUPT_COOP[key] : HELL_CORRUPT_SOLO[hero ?? 'ninja'];
  return [top, corrupt].filter((k): k is string => !!k).map((k) => `bg/${k}`);
}

/**
 * 地獄結局師父剛醒的那幾句到哪裡為止（之後才換相擁圖）。有「抱／攬進懷裡」那句就從那句換；
 * 噹噹、封封與多數連線版沒有那句，就在「重出江湖」、主角回話之後換（地獄結局固定是 開頭→交代→重出江湖→回話）。
 */
function hellWakeEnd(lines: readonly DialogueLine[]): number {
  const hug = lines.findIndex((l, i) => i > 0 && /懷裡/.test(l.text));
  if (hug > 0) return hug;
  const back = lines.findIndex((l) => l.speaker === '大俠貓' && l.text === '重出江湖。');
  return back >= 0 ? back + 2 : -1;
}
