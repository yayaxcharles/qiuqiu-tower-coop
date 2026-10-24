import { describe, expect, it } from 'vitest';
import COMBAT_RAW from '../../src/ui/screens/combat.ts?raw';
import enUi from '../../src/i18n/en/ui.json';
import jaUi from '../../src/i18n/ja/ui.json';

const COMBAT = COMBAT_RAW.replace(/\r\n/g, '\n');

/** 上線前修正 6（2026-10-24）：意圖牌子補寫「有傷害又有守」與「守＋自己的爪力」 */
describe('意圖牌子：守與爪力不漏寫', () => {
  it('傷害招補「＋守 n」「＋守 n（全體）」；加防增益招補「＋狀態 n」', () => {
    expect(COMBAT).toContain("if ((hits.length || rnd || boom) && blk) text += t('＋守 {n}'");
    expect(COMBAT).toContain("if ((hits.length || rnd || boom) && blkAll) text += t('＋守 {n}（全體）'");
    expect(COMBAT).toContain("if (f.kind === 'statusSelf') text += t('＋{status} {n}'");
  });

  it('新字串 en／ja 都有譯文', () => {
    for (const key of ['＋守 {n}（全體）', '＋{status} {n}']) {
      expect((enUi as Record<string, string>)[key], `en ${key}`).toBeTruthy();
      expect((jaUi as Record<string, string>)[key], `ja ${key}`).toBeTruthy();
    }
  });
});
