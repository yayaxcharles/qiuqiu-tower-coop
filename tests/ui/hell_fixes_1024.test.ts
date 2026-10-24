import { describe, expect, it } from 'vitest';
import APP_RAW from '../../src/ui/app.ts?raw';
import COMBAT_RAW from '../../src/ui/screens/combat.ts?raw';
import enUi from '../../src/i18n/en/ui.json';
import jaUi from '../../src/i18n/ja/ui.json';

const APP = APP_RAW.replace(/\r\n/g, '\n');
const COMBAT = COMBAT_RAW.replace(/\r\n/g, '\n');

describe('地獄最終審查修正（2026-10-24）', () => {
  it('hellTopScene：地獄模式不播原版塔頂門外那段（大俠貓在門口，跟魔源開場「你把師父怎麼了」矛盾），改播地獄版', () => {
    // 2026-10-24 起改成「地獄播 hellTopScene」（原本是整段不播）；細節與逐字稿子在 tests/content/hell_story.test.ts
    const m = APP.match(/const top = ([^\n]*topScene[^\n]*);/);
    expect(m, '找得到 top 那一行').not.toBeNull();
    const expr = m![1]!;
    expect(expr).toContain('hell ? topStory.hellTopScene : topStory.topScene');
    expect(APP).toContain('const hell = runMods(run).hellMode;');
    // 單人與連線（withMixed 包過的四位角色）都走同一個 storyFor，連線版在 storyFor 裡換好
    expect(APP).toContain('const topStory = run.act >= ACTS ? storyFor(localHero()) : undefined;');
  });

  it('sealChip：戰鬥畫面在 cs.hell.sealed 有值時才顯示「封：攻擊／技能」', () => {
    expect(COMBAT).toMatch(/const sealed = cs\.hell\?\.sealed;/);
    expect(COMBAT).toMatch(/sealed === undefined \? null : el\('b', \{ class: 'miasma seal' \}/);
    expect(COMBAT).toContain("t('封：攻擊')");
    expect(COMBAT).toContain("t('封：技能')");
  });

  it('sealChipI18n：英日兩語都有譯文', () => {
    for (const k of ['封：攻擊', '封：技能', '封條', '這一回合被封條封住的牌打不出來（能力牌不受影響）。']) {
      expect((enUi as Record<string, string>)[k], `en ${k}`).toBeTruthy();
      const ja = (jaUi as Record<string, string>)[k];
      expect(ja, `ja ${k}`).toBeTruthy();
    }
  });
});
