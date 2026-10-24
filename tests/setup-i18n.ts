// 多語系（2026-09-29）：繁中牌面產生器與名詞說明改成開場才載（src/i18n/zh.ts），測試一開始先載好，畫面測試照舊拿得到牌面文字
import { loadZhBase } from '../src/i18n';

await loadZhBase();

// 難度 6 的魔物與遭遇另包（src/content/enemies-hell.ts、首載不含）：測試一開始先載好並註冊，同步取用；首載進入點沒有靜態引用它另有測試（tests/content/hell-bundle.test.ts）
import { ensureHell } from '../src/content/enemies';

await ensureHell();
