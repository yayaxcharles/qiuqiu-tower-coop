import { describe, expect, it } from 'vitest';
import { enemies } from '../../src/content/enemies';
import { dialogue, feifeiLineOk, qiuqiuLineOk } from '../../src/content/dialogue';
import { fengfengFirstMeet } from '../../src/content/fengfeng-dialogue';
import { HELL_FIRST_MEET } from '../../src/content/hell-quips';

/** 直接讀另包的模組（主程式靠 `loadHellQuips()` 動態載入，見 hell_quips_lazy.test.ts） */
const firstMeetLine = (h: string, id: string): string => HELL_FIRST_MEET[h]?.[id] ?? '';

/** 使用者 10-24 認可的 12 句（story-approved 第 C 節），一字不改 */
const APPROVED: Record<string, [string, string, string, string]> = {
  hell_hourglass_moth: [
    '翅膀上的沙一直往下漏，好像在幫誰數時間喵。',
    '牠一拍翅膀，沙子就掉一點……掉完的時候會怎樣？',
    '沙漏倒數，就是叫我們別拖。',
    '翅膀上的沙在漏，出劍要快。',
  ],
  hell_umbrella_thief: [
    '那條舌頭一直往我的手牌捲過來，不要舔喵！',
    '牠的舌頭好長……我的針筒要抱緊一點。',
    '傘破成這樣還撐著，舌頭倒是伸得很長。手上的東西收好。',
    '舌頭伸過來就砍。手上的牌別讓牠捲走。',
  ],
  hell_kagemusha_cat: [
    '牠舉著門板擋在前面，後面的都打不到了喵。',
    '那塊門板好大……我丟的針，全被牠攔下來了。',
    '拿門板當盾，跟我一樣。先把牠推開。',
    '牠替後面的擋劍。先破這面盾。',
  ],
};

const HEROES = ['ninja', 'feifei', 'dangdang', 'fengfeng'] as const;
const hellIds = enemies.filter((e) => e.id.startsWith('hell_')).map((e) => e.id);

describe('地獄魔物的初見吐槽', () => {
  it('四位角色對每一隻地獄魔物都有一句，句尾規矩照各自的口氣', () => {
    expect(hellIds.length).toBe(48);
    for (const id of hellIds) {
      const t = HEROES.map((h) => firstMeetLine(h, id));
      for (let i = 0; i < 4; i++) expect(t[i], `${HEROES[i]}／${id}`).toBeTruthy();
      expect(qiuqiuLineOk(t[0]!), `球球／${id}：${t[0]}`).toBe(true);
      for (const l of t.slice(1)) expect(feifeiLineOk(l), `${id}：${l}`).toBe(true);
      for (const l of t.slice(1)) expect(l, `${id}：${l}`).not.toContain('喵');
    }
  });

  it('同一隻魔物的四句，兩兩不重複', () => {
    for (const id of hellIds) {
      const t = HEROES.map((h) => firstMeetLine(h, id));
      expect(new Set(t).size, id).toBe(4);
    }
  });

  it('四位角色的表鍵一樣多、剛好是地獄魔物；一般難度的四張表一個地獄鍵都沒有', () => {
    const ids = new Set(hellIds);
    for (const h of HEROES) expect(Object.keys(HELL_FIRST_MEET[h]!).sort(), h).toEqual([...hellIds].sort());
    for (const tbl of [dialogue.firstMeet, dialogue.firstMeetFeifei, dialogue.firstMeetDangdang, fengfengFirstMeet]) {
      expect(Object.keys(tbl).filter((k) => ids.has(k)), '一般難度的表混進地獄鍵＝回到首載').toEqual([]);
      expect(Object.keys(tbl).length).toBe(enemies.length - hellIds.length);
    }
  });

  it('使用者認可的 12 句一字不改', () => {
    for (const [id, lines] of Object.entries(APPROVED)) {
      HEROES.forEach((h, i) => expect(firstMeetLine(h, id), `${h}／${id}`).toBe(lines[i]));
    }
  });

  it('不替地獄魔物把師父搬出來：地獄不打師父', () => {
    for (const id of hellIds) for (const h of HEROES) expect(firstMeetLine(h, id), `${h}／${id}`).not.toMatch(/師父|大俠貓/);
  });
});
