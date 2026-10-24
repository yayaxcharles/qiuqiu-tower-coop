import type { EnemyDef, EnemyEffect, EnemyMove, EncounterDef } from '../engine/types';

/**
 * 難度 6「地獄」的魔物與遭遇（設計稿 docs/superpowers/specs/2026-10-21-hell-difficulty-design.md）。
 *
 * 三關各 12 隻一般＋3 隻大魔物＋1 隻關主，編號 `hell_<工單名>`，立繪 `codex/monster_hell_<工單名>`（工單 tools/make_hell_jobs.py）。
 * 第三關的關主魔源（`hell_source`）這裡只放第一形態；換階段、四個形態的招式之後再補。
 *
 * 這一版的招式只用**現有**效果，血量與傷害照同關同池的現有魔物。新機制（偷牌、封牌、看穿、嘲諷、同伴倒下暴怒）
 * 要換上的地方都標了 `// Task N:`，之後只改那一行效果，不動結構。
 *
 * 地獄遭遇一律 `hell: true`、`acts` 只有自己那一關；一般難度的 `encountersOfPool` 會把它們整批濾掉。
 */

const dmg = (amount: number, times?: number): EnemyEffect => (times ? { kind: 'damage', amount, times } : { kind: 'damage', amount });
const blk = (amount: number): EnemyEffect => ({ kind: 'block', amount });
const selfClaw = (amount: number): EnemyEffect => ({ kind: 'statusSelf', name: '爪力', amount });
const allyClaw = (amount: number): EnemyEffect => ({ kind: 'statusAllies', name: '爪力', amount });
const onPlayer = (name: '炸毛' | '懶洋洋' | '翻肚', amount: number): EnemyEffect => ({ kind: 'statusPlayer', name, amount });
const dazed = (n: number, to: 'draw' | 'discard'): EnemyEffect => ({ kind: 'giveCard', cardId: 'dazed_card', n, to });
const slime = (n: number): EnemyEffect => ({ kind: 'giveCard', cardId: 'slime_card', n, to: 'discard' });
const drop = (n: number): EnemyEffect => ({ kind: 'discardRandomHand', n });
const steal = (n: number): EnemyEffect => ({ kind: 'stealCard', n });
const seal = (type: 'attack' | 'skill'): EnemyEffect => ({ kind: 'sealType', type });
const mv = (intent: EnemyMove['intent'], label: string, ...effects: EnemyEffect[]): EnemyMove => ({ intent, label, effects });

export const hellEnemies: EnemyDef[] = [
  // =====================================================================
  // 第一關「快」：越活越強、叫增援、逃跑帶走戰利品、自爆倒數
  // =====================================================================
  // ----- 弱 -----
  { id: 'hell_fuse_imp', name: '引信小鬼', hp: [14, 16], pool: '弱', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_fuse_imp',
    line: '嘶嘶……快燒完了！', lines: ['（頭上的引信燒得更短了）'],
    moves: [
      mv('buff', '點火', selfClaw(1)),
      mv('attack', '撲咬', dmg(3)),
      mv('attack', '引信燒完', { kind: 'selfDestruct', amount: 10 }),
    ] },
  { id: 'hell_onibi_rats', name: '鬼火鼠群', hp: [16, 20], pool: '弱', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_onibi_rats',
    line: '吱吱吱！火來了！', lines: ['（四隻擠成一團，頭上的鬼火晃來晃去）'],
    moves: [
      mv('attack', '群啃', dmg(2, 2)),
      mv('debuff', '鬼火亂飄', onPlayer('炸毛', 1)),
      mv('attack', '群啃', dmg(3, 2)),
    ] },
  { id: 'hell_candle_monk', name: '蠟燭小僧', hp: [18, 22], pool: '弱', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_candle_monk',
    line: '……阿彌陀佛。', lines: ['（蠟油一滴一滴往下掉）'], strengthEveryNTurns: 2,
    moves: [
      mv('block', '誦經', blk(6)),
      mv('attack', '滴蠟', dmg(4)),
      mv('attack', '滴蠟', dmg(4)),
    ] },
  { id: 'hell_spark_beetle', name: '火花甲蟲', hp: [18, 22], pool: '弱', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_spark_beetle',
    line: '亮晶晶，跟我走！', lines: ['（屁股一閃一閃，小火花繞著牠轉）'],
    moves: [
      mv('attack', '閃光', dmg(4)),
      mv('summon', '召喚火花', { kind: 'summon', enemyId: 'hell_fuse_imp', n: 1, max: 2 }),
      mv('attack', '閃光', dmg(5)),
    ] },
  { id: 'hell_geta_runner', name: '木屐小跑', hp: [16, 20], pool: '弱', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_geta_runner',
    line: '拿了就跑，不送！', lines: ['（一隻腳已經抬起來了）'],
    moves: [
      mv('special', '順手牽魚', { kind: 'stealFish', n: 6 }, dmg(2)),
      mv('attack', '踢', dmg(4)),
      mv('special', '溜走', { kind: 'escape' }),
    ] },
  // ----- 中 -----
  { id: 'hell_loot_weasel', name: '奪寶鼬', hp: [38, 42], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_loot_weasel',
    line: '值錢的都交出來！', lines: ['（背上的袋子鼓鼓的）'],
    moves: [
      mv('special', '搶袋子', { kind: 'stealFish', n: 10 }, dmg(3)),
      mv('attack', '鐮爪', dmg(8)),
      mv('attack', '鐮爪', dmg(8)),
      mv('special', '帶著贓物逃', { kind: 'escape' }),
    ] },
  { id: 'hell_hourglass_moth', name: '沙漏蛾', hp: [40, 44], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_hourglass_moth',
    line: '沙子……快漏完了……', lines: ['（翅膀一搧，紫色的沙就飄下來）'], strengthEveryNTurns: 3,
    moves: [
      mv('debuff', '撒沙', onPlayer('炸毛', 2)),
      mv('attack', '撲翅', dmg(6)),
      mv('attack', '沙落', dmg(3, 2)),
    ] },
  { id: 'hell_drum_tanuki', name: '戰鼓狸', hp: [44, 48], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_drum_tanuki',
    line: '咚咚咚！戰鼓響起來！', lines: ['（拍著肚子，眼睛發紫光）'],
    moves: [
      mv('buff', '擂鼓助陣', allyClaw(1)),
      mv('attack', '腹鼓震', dmg(7)),
      mv('attack', '腹鼓震', dmg(7)),
    ] },
  { id: 'hell_miasma_bud', name: '毒瘴花苞', hp: [42, 46], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_miasma_bud',
    line: '（花苞慢慢張開一條縫）', lines: ['（裡面有東西在發光）'],
    moves: [
      mv('debuff', '吐瘴氣', onPlayer('懶洋洋', 1), dmg(3)),
      mv('attack', '張口一咬', dmg(8)),
      mv('block', '收攏花瓣', blk(8), { kind: 'heal', n: 4 }),
    ] },
  { id: 'hell_ember_snail', name: '炭火蝸牛', hp: [48, 52], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_ember_snail',
    line: '慢……慢慢來……', lines: ['（殼裡的炭火越燒越旺）'],
    moves: [
      mv('block', '縮進殼裡', blk(10)),
      mv('attack', '噴炭火', dmg(7), onPlayer('炸毛', 1)),
      mv('attack', '燒灼', dmg(4, 2)),
    ] },
  // ----- 強 -----
  { id: 'hell_fire_wheel', name: '火輪入道', hp: [56, 62], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_fire_wheel',
    line: '轟隆隆隆——！', lines: ['（輪子轉得冒出火星）'],
    moves: [
      mv('buff', '助跑', selfClaw(2)),
      mv('attack', '輾過去', dmg(7)),
      mv('attack', '回轉', dmg(4, 2)),
    ] },
  { id: 'hell_conch_oni', name: '法螺鬼', hp: [54, 60], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_conch_oni',
    line: '呼——嗚——大家都過來！', lines: ['（把海螺湊到嘴邊用力吹）'],
    moves: [
      mv('summon', '吹法螺', { kind: 'summon', enemyId: 'hell_fuse_imp', n: 2, max: 3 }),
      mv('attack', '螺殼砸', dmg(7)),
      mv('attack', '螺殼砸', dmg(7)),
    ] },
  // ----- 大魔物 -----
  { id: 'hell_clock_oni', name: '鐘面赤鬼', hp: [110, 110], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_clock_oni',
    line: '時辰到了！', lines: ['（背後的大銅鐘嗡嗡作響）', '鐘一響，你就沒時間了。'], strengthEveryNTurns: 3,
    moves: [
      mv('buff', '鐘鳴', selfClaw(2), blk(8)),
      mv('attack', '槌擊', dmg(12)),
      mv('attack', '連敲', dmg(6, 2)),
    ] },
  { id: 'hell_rush_boar', name: '疾衝山豬', hp: [100, 100], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_rush_boar',
    line: '（鼻孔噴著白煙，低頭刨地）', lines: ['（鬃毛的紫火燒得更旺）', '（蹄子一蹬，地面裂開）'],
    moves: [
      mv('special', '蓄勢', { kind: 'chargeNext' }),
      mv('attack', '猛衝', dmg(15)),
      mv('attack', '獠牙橫掃', dmg(6, 2)),
    ] },
  { id: 'hell_sand_golem', name: '沙漏石魔', hp: [120, 120], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_sand_golem',
    line: '（沙子從身體縫裡不停流下來）', lines: ['（胸口的沙漏快要見底了）', '……時間，不夠了。'],
    moves: [
      mv('buff', '沙落護體', blk(14), selfClaw(1)),
      mv('attack', '石拳砸地', dmg(14)),
      mv('debuff', '流沙', dmg(6), onPlayer('懶洋洋', 2)),
    ] },
  // ----- 關主 -----
  { id: 'hell_hourglass_shogun', name: '沙漏將軍', hp: [150, 150], pool: '塔主', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_hourglass_shogun',
    line: '沙漏翻轉之時，便是你的死期。', lines: ['（拔出長刀，紫色的沙從鎧甲縫裡漏出）', '拖越久，我越強。'],
    moves: [
      mv('attack', '居合斬', dmg(15)),
      mv('buff', '倒轉沙漏', selfClaw(2), blk(8)),
      mv('attack', '三連斬', dmg(6, 3)),
      mv('summon', '召兵', { kind: 'summon', enemyId: 'hell_fuse_imp', n: 2, max: 4 }),
    ] },

  // =====================================================================
  // 第二關「亂」：偷牌、封牌、往牌組塞東西、打亂手牌
  // =====================================================================
  // ----- 中 -----
  { id: 'hell_pickpocket_monkey', name: '扒手猴', hp: [46, 52], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_pickpocket_monkey',
    line: '借我看一下～', lines: ['（手裡已經多了一張不是自己的牌）'],
    moves: [
      mv('special', '順走一張', steal(1), dmg(6)),   // 偷牌（魔物倒下時還牌）
      mv('attack', '抓', dmg(9)),
      mv('debuff', '嬉鬧', dazed(1, 'draw')),
    ] },
  { id: 'hell_ofuda_ghost', name: '符紙鬼', hp: [40, 46], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_ofuda_ghost',
    line: '（紙條輕輕飄到你面前）', lines: ['（朱紅的印章閃了一下）'],
    moves: [
      mv('debuff', '貼符', seal('attack'), dmg(4)),   // 封牌：封攻擊
      mv('attack', '飄', dmg(10)),
      mv('debuff', '貼符', seal('skill'), dmg(4)),   // 封牌：封技能
    ] },
  { id: 'hell_shuffle_fox', name: '洗牌狐', hp: [52, 58], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_shuffle_fox',
    line: '來來來，猜猜你的牌在哪？', lines: ['（空中的牌轉成一個圈）'],
    moves: [
      mv('special', '洗牌', drop(2), dmg(6)),
      mv('attack', '狐火', dmg(12)),
      mv('block', '假動作', blk(8), onPlayer('炸毛', 1)),
    ] },
  { id: 'hell_trash_goblin', name: '垃圾小妖', hp: [40, 44], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_trash_goblin',
    line: '嘿嘿，送你一包好東西！', lines: ['（拖著另一包垃圾，魚骨頭還插在頭上）'],
    moves: [
      mv('debuff', '扔垃圾', slime(1), dmg(6)),
      mv('block', '拖袋子', blk(8)),
      mv('debuff', '亂丟', slime(2)),
    ] },
  { id: 'hell_paper_crane', name: '紙牌鶴', hp: [44, 50], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_paper_crane',
    line: '（翅膀一拍，牌片滿天飛）', lines: ['（紙做的嘴喀喀響）'],
    moves: [
      mv('debuff', '折牌', dazed(1, 'draw'), dmg(6)),
      mv('attack', '紙刃', dmg(4, 3)),
      mv('debuff', '撒牌', dazed(2, 'discard')),
    ] },
  { id: 'hell_dice_goblin', name: '骰子鬼', hp: [42, 48], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_dice_goblin',
    line: '賭一把，輸了算你的！', lines: ['（三顆大骰子在空中轉個不停）'],
    moves: [
      mv('special', '擲骰', drop(1), dmg(7)),
      mv('attack', '豪賭', { kind: 'damageRandom', min: 3, max: 15 }),
      mv('special', '擲骰', drop(1), dmg(7)),
    ] },
  { id: 'hell_ink_brush', name: '墨筆怪', hp: [54, 60], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_ink_brush',
    line: '來，我幫你畫一筆。', lines: ['（筆尖滴著黑紫色的墨）'],
    moves: [
      mv('debuff', '潑墨', seal('skill'), dmg(6)),   // 封牌：封技能
      mv('attack', '一筆勾銷', dmg(13)),
      mv('block', '落筆', blk(8), dmg(6)),
    ] },
  // ----- 強 -----
  { id: 'hell_magpie_tengu', name: '喜鵲天狗', hp: [66, 72], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_magpie_tengu',
    line: '亮晶晶的東西，都是我的！', lines: ['（窩裡堆滿了閃亮的小東西）'],
    moves: [
      mv('special', '叼走', drop(2), dmg(13)),
      mv('attack', '俯衝', dmg(27)),
      mv('debuff', '撒寶', dazed(2, 'discard')),
    ] },
  { id: 'hell_junk_mimic', name: '雜物寶箱怪', hp: [72, 80], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_junk_mimic',
    line: '（箱蓋打開一條縫，舌頭掛在外面）', lines: ['（吐出一隻破草鞋）'],
    moves: [
      mv('debuff', '吐雜物', slime(2)),
      mv('attack', '咬', dmg(27)),
      mv('special', '吞牌', steal(1), dmg(11)),   // 偷牌
    ] },
  { id: 'hell_ink_octopus', name: '墨汁章魚', hp: [64, 72], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_ink_octopus',
    line: '嘿嘿，看不見了吧。', lines: ['（八隻腳抱著捲軸，臉上沾著墨）'],
    moves: [
      mv('debuff', '噴墨', seal('skill')),   // 封牌：封技能
      mv('attack', '觸手連打', dmg(7, 4)),
      mv('block', '墨幕', blk(10)),
    ] },
  { id: 'hell_lock_spider', name: '鎖頭蜘蛛', hp: [68, 76], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_lock_spider',
    line: '（鎖鏈嘩啦嘩啦地響）', lines: ['（鎖孔旁一排紫色的小眼睛盯著你）'],
    moves: [
      mv('debuff', '鎖鏈纏', seal('attack'), dmg(11)),   // 封牌：封攻擊
      mv('attack', '咬', dmg(25)),
      mv('debuff', '結網', dazed(2, 'draw')),
    ] },
  { id: 'hell_umbrella_thief', name: '破傘賊', hp: [66, 72], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_umbrella_thief',
    line: '（破傘一撐，裡面全是別人的牌）', lines: ['（獨腳跳了一下，舌頭甩出來）'],
    moves: [
      mv('special', '舌頭一捲', steal(1), dmg(11)),   // 偷牌（魔物倒下時還牌）
      mv('attack', '單腳跳踢', dmg(25)),
      mv('block', '撐傘', blk(10), selfClaw(1)),
    ] },
  // ----- 大魔物 -----
  { id: 'hell_vault_tortoise', name: '金庫老龜', hp: [120, 120], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_vault_tortoise',
    line: '……鎖好了。誰都別想拿走。', lines: ['（龜殼上的鎖盤喀噠喀噠轉）', '進了我的殼，就出不來了。'],
    moves: [
      mv('block', '縮進金庫', blk(18)),
      mv('attack', '老龜咬', dmg(24)),
      mv('debuff', '鎖死', seal('skill'), dazed(2, 'draw')),   // 封牌：封技能
    ] },
  { id: 'hell_card_dragon', name: '紙牌龍', hp: [112, 112], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_card_dragon',
    line: '（紙片沙沙響，盤成一圈）', lines: ['（身上的牌片翻飛）', '（張開嘴，一疊牌噴出來）'],
    moves: [
      mv('debuff', '吐牌', dazed(2, 'draw'), dmg(12)),
      mv('attack', '龍尾', dmg(13, 2)),
      mv('special', '吞牌', steal(2), dmg(15)),   // 偷牌
    ] },
  { id: 'hell_chain_warden', name: '鎖鏈獄卒', hp: [124, 124], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_chain_warden',
    line: '（鐵鍊在地上拖出長長的聲音）', lines: ['（腰上的鑰匙串叮噹作響）', '犯人，就該乖乖待著。'],
    moves: [
      mv('debuff', '甩鏈', dmg(21), seal('attack')),   // 封牌：封攻擊
      mv('block', '銬住', blk(12), onPlayer('炸毛', 2)),
      mv('attack', '鑰匙串重擊', dmg(27)),
    ] },
  // ----- 關主 -----
  { id: 'hell_hoarder_toad', name: '囤寶蛙大名', hp: [240, 240], pool: '塔主', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_hoarder_toad',
    line: '這些都是本大名的，一張也不許少。', lines: ['（坐在牌堆上，大印章靠在膝蓋）', '你的牌，先借我保管。'],
    moves: [
      mv('attack', '蓋印', dmg(12), seal('skill')),   // 封牌：蓋印封住技能牌
      mv('special', '長舌捲牌', steal(2), dmg(10)),   // 偷牌
      mv('block', '坐擁寶山', blk(16), { kind: 'heal', n: 8 }),
      mv('attack', '大印連砸', dmg(9, 3)),
    ] },

  // =====================================================================
  // 第三關「狡猾」：互相配合、看穿玩家常用打法
  // =====================================================================
  // ----- 中 -----
  { id: 'hell_spy_crow', name: '斥候烏鴉', hp: [54, 60], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_spy_crow',
    line: '嘎，我都看見了。', lines: ['（舉著望遠鏡，歪著頭）'],
    moves: [
      mv('debuff', '偵察', onPlayer('炸毛', 1)),
      mv('attack', '俯衝', dmg(15)),
      mv('attack', '啄', dmg(8, 2)),
    ] },
  { id: 'hell_smoke_rat', name: '煙遁鼠', hp: [60, 66], pool: '中', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_smoke_rat',
    line: '（人影一閃，只剩一陣煙）', lines: ['（手裡握著苦無，眼睛四處亂轉）'],
    moves: [
      mv('buff', '煙遁', { kind: 'statusSelf', name: '隱身', amount: 1 }),
      mv('attack', '苦無', dmg(14)),
      mv('block', '閃身', blk(10)),
    ] },
  { id: 'hell_mirror_eye', name: '鏡眼', hp: [46, 52], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_mirror_eye',
    line: '（鏡面中央的大眼睛轉了過來）', lines: ['（流蘇輕輕晃動）'],
    moves: [
      mv('debuff', '凝視', onPlayer('炸毛', 2)),
      mv('attack', '反光', dmg(16)),
      mv('block', '照妖', blk(8), onPlayer('懶洋洋', 1)),
    ] },
  { id: 'hell_banner_imp', name: '旗手小鬼', hp: [40, 46], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_banner_imp',
    line: '大家加油！我來助陣！', lines: ['（把旗子插好，挺起胸膛）'],
    moves: [
      mv('buff', '揮旗', allyClaw(2)),
      mv('attack', '旗桿砸', dmg(12)),
      mv('block', '鼓舞', { kind: 'blockAllies', amount: 6 }),
    ] },
  { id: 'hell_medicine_bat', name: '藥蝠', hp: [42, 48], pool: '中', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_medicine_bat',
    line: '來，吃藥！很苦但有效！', lines: ['（葫蘆搖得叮叮咚咚）'],
    moves: [
      mv('block', '分藥', { kind: 'blockAllies', amount: 8 }, dmg(6)),
      mv('attack', '潑藥水', dmg(12)),
      mv('debuff', '苦藥', onPlayer('懶洋洋', 2)),
    ] },
  // ----- 強 -----
  { id: 'hell_shell_kappa', name: '甲羅河童', hp: [78, 86], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_shell_kappa',
    taunt: true,
    line: '你要先過我這一關。', lines: ['（龜殼盾牌舉在胸前）'],
    moves: [
      mv('block', '舉盾護隊', { kind: 'blockAllies', amount: 10 }),
      mv('attack', '盾擊', dmg(17)),
      mv('attack', '短槍連刺', dmg(12, 2)),
    ] },
  { id: 'hell_twin_moon', name: '雙子・月', hp: [62, 68], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_twin_moon',
    enrageOnAllyDeath: 3,
    line: '姐姐，我先上了。', lines: ['（彎彎的月牙刀垂在身後）'],
    moves: [
      mv('attack', '月牙斬', dmg(15)),
      mv('block', '月光護體', { kind: 'blockAllies', amount: 8 }),
      mv('attack', '疾斬', dmg(8, 2)),
    ] },
  { id: 'hell_twin_sun', name: '雙子・日', hp: [62, 68], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_twin_sun',
    enrageOnAllyDeath: 3,
    line: '妹妹，別搶我的。', lines: ['（高舉金色的刀）'],
    moves: [
      mv('attack', '烈日斬', dmg(19)),
      mv('buff', '日冕', allyClaw(1)),
      mv('attack', '連劈', dmg(9, 2)),
    ] },
  { id: 'hell_strategist_owl', name: '軍師鴞', hp: [66, 72], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_strategist_owl',
    line: '嗯，依我看，該這麼打。', lines: ['（搧著羽扇，眼睛瞇成一條線）'],
    moves: [
      mv('buff', '下軍令', allyClaw(2)),
      mv('debuff', '撥算盤', { kind: 'stripPlayer', names: ['隱身', '潛水'] }, dmg(10)),
      mv('attack', '羽扇擊', dmg(17)),
    ] },
  { id: 'hell_kagemusha_cat', name: '影武者貓', hp: [80, 88], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_kagemusha_cat',
    taunt: true,
    line: '……我替他擋著。', lines: ['（木盾立在身前，像一面牆）'],
    moves: [
      mv('block', '舉盾守陣', blk(14), { kind: 'blockAllies', amount: 6 }),
      mv('attack', '盾推', dmg(14)),
      mv('block', '盾牆', { kind: 'blockAllies', amount: 12 }),
    ] },
  { id: 'hell_war_drum_frog', name: '戰鼓蛙', hp: [74, 82], pool: '強', pattern: 'cycle', size: 'medium', art: 'codex/monster_hell_war_drum_frog',
    line: '呱——咚！咚！咚！', lines: ['（閉著眼，一下一下地擂鼓）'],
    moves: [
      mv('buff', '擂戰鼓', allyClaw(2)),
      mv('attack', '蛙跳壓', dmg(19)),
      mv('attack', '鼓聲震', dmg(9, 2)),
    ] },
  { id: 'hell_vengeful_doll', name: '怨念人偶', hp: [58, 64], pool: '強', pattern: 'cycle', size: 'small', art: 'codex/monster_hell_vengeful_doll',
    enrageOnAllyDeath: 4,
    line: '……為什麼，不等我。', lines: ['（長髮飄起，身邊的紫火輕輕搖晃）'],
    moves: [
      mv('debuff', '低吟', onPlayer('炸毛', 2)),
      mv('attack', '怨火', dmg(13)),
      mv('attack', '怨火纏身', dmg(6, 2), selfClaw(1)),
    ] },
  // ----- 大魔物 -----
  { id: 'hell_three_face_ashura', name: '三面修羅', hp: [190, 190], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_three_face_ashura',
    line: '（三張臉各看向不同的方向）', lines: ['（四隻手各握一件兵器）', '怒、笑、靜，你想先見哪一張？'],
    moves: [
      mv('attack', '怒面・刀', dmg(17)),
      mv('attack', '笑面・槍', dmg(7, 3)),
      mv('block', '靜面・鈴', blk(16), onPlayer('炸毛', 2)),
      mv('attack', '四臂齊斬', dmg(8, 4)),
    ] },
  { id: 'hell_nue', name: '鵺', hp: [175, 175], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_nue',
    line: '（猴臉、虎腳、蛇尾，同時發出聲音）', lines: ['（尾巴上的蛇嘶嘶吐信）', '（身上的烏雲翻滾）'],
    moves: [
      mv('attack', '蛇尾纏咬', dmg(8), onPlayer('懶洋洋', 2)),
      mv('attack', '虎撲', dmg(17)),
      mv('debuff', '猿嚎', onPlayer('炸毛', 2), selfClaw(1)),
      mv('debuff', '黑雲壓頂', dazed(2, 'draw')),
    ] },
  { id: 'hell_bone_commander', name: '骸骨大將', hp: [180, 180], pool: '大魔物', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_bone_commander',
    line: '全軍聽令。', lines: ['（骨頭咯咯響，軍扇一揮）', '（紫火在眼窩裡燒起來）'],
    moves: [
      mv('summon', '號令出兵', { kind: 'summon', enemyId: 'hell_banner_imp', n: 2, max: 2 }),
      mv('attack', '軍扇揮', dmg(14)),
      mv('attack', '骨手拍', dmg(19)),
      mv('block', '列陣', { kind: 'blockAllies', amount: 10 }),
    ] },
  // ----- 關主：魔源（這一版只有第一形態「紫霧之繭」；四階段之後再補）-----
  { id: 'hell_source', name: '魔源・紫冥', hp: [150, 150], pool: '塔主', pattern: 'cycle', size: 'large', art: 'codex/monster_hell_source',
    line: '（紫霧裹成的巨繭，慢慢地脈動）', lines: ['（繭上的金色豎瞳，緩緩轉向你）', '……封印，斷了。'],
    moves: [
      mv('attack', '紫霧噴吐', dmg(12), onPlayer('炸毛', 1)),
      mv('block', '繭甲', blk(14)),
      mv('buff', '魔氣湧', selfClaw(2)),
      mv('attack', '破繭衝', dmg(10, 2)),
    ] },
];

const enc = (id: string, pool: EncounterDef['pool'], act: number, enemies: string[], extra: Partial<EncounterDef> = {}): EncounterDef =>
  ({ id: `hell_${id}`, pool, enemies: enemies.map((n) => `hell_${n}`), acts: [act], hell: true, ...extra });

export const hellEncounters: EncounterDef[] = [
  // ===== 第一關 =====
  enc('fuse_imp', '弱', 1, ['fuse_imp'], { hpScale: 1.46 }),
  enc('onibi_rats', '弱', 1, ['onibi_rats'], { hpScale: 1.46 }),
  enc('candle_monk', '弱', 1, ['candle_monk'], { hpScale: 1.46 }),
  enc('spark_beetle', '弱', 1, ['spark_beetle'], { hpScale: 1.46 }),
  enc('geta_runner', '弱', 1, ['geta_runner'], { hpScale: 1.46 }),
  enc('fuse_pair', '弱', 1, ['fuse_imp', 'fuse_imp'], { hpScale: 1.46 }),
  enc('beetle_runner', '弱', 1, ['spark_beetle', 'geta_runner'], { hpScale: 1.31 }),
  enc('monk_rats', '弱', 1, ['candle_monk', 'onibi_rats'], { hpScale: 1.31 }),
  enc('loot_weasel', '中', 1, ['loot_weasel'], { hpScale: 0.92 }),
  enc('hourglass_moth', '中', 1, ['hourglass_moth'], { hpScale: 0.92 }),
  enc('drum_tanuki', '中', 1, ['drum_tanuki'], { hpScale: 0.92 }),
  enc('miasma_bud', '中', 1, ['miasma_bud'], { hpScale: 0.92 }),
  enc('ember_snail', '中', 1, ['ember_snail'], { hpScale: 0.92 }),
  enc('moth_beetle', '中', 1, ['hourglass_moth', 'spark_beetle'], { hpScale: 0.78 }),
  enc('weasel_runner', '中', 1, ['loot_weasel', 'geta_runner'], { hpScale: 0.78 }),
  enc('tanuki_rats', '中', 1, ['drum_tanuki', 'onibi_rats'], { hpScale: 0.78 }),
  enc('bud_monk', '中', 1, ['miasma_bud', 'candle_monk'], { hpScale: 0.78 }),
  enc('fire_wheel', '強', 1, ['fire_wheel'], { hpScale: 0.85 }),
  enc('conch_oni', '強', 1, ['conch_oni'], { hpScale: 0.85 }),
  enc('wheel_imps', '強', 1, ['fire_wheel', 'fuse_imp', 'fuse_imp'], { hpScale: 0.68 }),
  enc('conch_moth', '強', 1, ['conch_oni', 'hourglass_moth'], { hpScale: 0.68 }),
  enc('snail_bud', '強', 1, ['ember_snail', 'miasma_bud'], { hpScale: 0.68 }),
  enc('weasel_wheel', '強', 1, ['loot_weasel', 'fire_wheel'], { hpScale: 0.64 }),
  enc('tanuki_conch', '強', 1, ['drum_tanuki', 'conch_oni'], { hpScale: 0.64 }),
  enc('clock_oni', '大魔物', 1, ['clock_oni'], { hpScale: 0.74 }),
  enc('rush_boar', '大魔物', 1, ['rush_boar'], { hpScale: 0.74 }),
  enc('sand_golem', '大魔物', 1, ['sand_golem'], { hpScale: 0.74 }),
  enc('hourglass_shogun', '塔主', 1, ['hourglass_shogun']),

  // ===== 第二關 =====
  enc('pickpocket_monkey', '中', 2, ['pickpocket_monkey'], { hpScale: 1.04 }),
  enc('ofuda_ghost', '中', 2, ['ofuda_ghost'], { hpScale: 1.04 }),
  enc('shuffle_fox', '中', 2, ['shuffle_fox'], { hpScale: 1.04 }),
  enc('trash_goblin', '中', 2, ['trash_goblin'], { hpScale: 1.04 }),
  enc('paper_crane', '中', 2, ['paper_crane'], { hpScale: 1.04 }),
  enc('dice_goblin', '中', 2, ['dice_goblin'], { hpScale: 1.04 }),
  enc('ink_brush', '中', 2, ['ink_brush'], { hpScale: 1.04 }),
  enc('dice_crane', '中', 2, ['dice_goblin', 'paper_crane'], { hpScale: 0.83 }),
  enc('ofuda_goblin', '中', 2, ['ofuda_ghost', 'trash_goblin'], { hpScale: 0.83 }),
  enc('monkey_brush', '中', 2, ['pickpocket_monkey', 'ink_brush'], { hpScale: 0.78 }),
  enc('magpie_tengu', '強', 2, ['magpie_tengu'], { hpScale: 1.06 }),
  enc('junk_mimic', '強', 2, ['junk_mimic'], { hpScale: 1.06 }),
  enc('ink_octopus', '強', 2, ['ink_octopus'], { hpScale: 1.06 }),
  enc('lock_spider', '強', 2, ['lock_spider'], { hpScale: 1.06 }),
  enc('umbrella_thief', '強', 2, ['umbrella_thief'], { hpScale: 1.06 }),
  enc('tengu_umbrella', '強', 2, ['magpie_tengu', 'umbrella_thief'], { hpScale: 0.85 }),
  enc('mimic_goblin', '強', 2, ['junk_mimic', 'trash_goblin'], { hpScale: 0.9 }),
  enc('octopus_brush', '強', 2, ['ink_octopus', 'ink_brush'], { hpScale: 0.85 }),
  enc('spider_ghost', '強', 2, ['lock_spider', 'ofuda_ghost'], { hpScale: 0.9 }),
  enc('fox_monkey', '強', 2, ['shuffle_fox', 'pickpocket_monkey'], { hpScale: 0.85 }),
  enc('crane_dice_thief', '強', 2, ['paper_crane', 'dice_goblin', 'umbrella_thief'], { hpScale: 0.8 }),
  enc('vault_tortoise', '大魔物', 2, ['vault_tortoise']),
  enc('card_dragon', '大魔物', 2, ['card_dragon']),
  enc('chain_warden', '大魔物', 2, ['chain_warden']),
  enc('hoarder_toad', '塔主', 2, ['hoarder_toad']),

  // ===== 第三關（組合佔一半以上，配合才成立）=====
  enc('spy_crow', '中', 3, ['spy_crow'], { hpScale: 1.54, strength: 4 }),
  enc('smoke_rat', '中', 3, ['smoke_rat'], { hpScale: 1.54, strength: 4 }),
  enc('mirror_eye', '中', 3, ['mirror_eye'], { hpScale: 1.54, strength: 4 }),
  enc('crow_banner', '中', 3, ['spy_crow', 'banner_imp'], { hpScale: 1.31, strength: 4 }),
  enc('bat_rat', '中', 3, ['medicine_bat', 'smoke_rat'], { hpScale: 1.31, strength: 4 }),
  enc('eye_banner', '中', 3, ['mirror_eye', 'banner_imp'], { hpScale: 1.31, strength: 4 }),
  enc('crow_bat', '中', 3, ['spy_crow', 'medicine_bat'], { hpScale: 1.31, strength: 4 }),
  enc('rat_eye', '中', 3, ['smoke_rat', 'mirror_eye'], { hpScale: 1.31, strength: 4 }),
  enc('shell_kappa', '強', 3, ['shell_kappa'], { hpScale: 1.1, strength: 4 }),
  enc('war_drum_frog', '強', 3, ['war_drum_frog'], { hpScale: 1.1, strength: 4 }),
  enc('twins', '強', 3, ['twin_moon', 'twin_sun'], { hpScale: 0.88, strength: 2 }),
  enc('owl_kappa', '強', 3, ['strategist_owl', 'shell_kappa'], { hpScale: 0.88, strength: 2 }),
  enc('cat_moon', '強', 3, ['kagemusha_cat', 'twin_moon'], { hpScale: 0.88, strength: 2 }),
  enc('frog_sun', '強', 3, ['war_drum_frog', 'twin_sun'], { hpScale: 0.88, strength: 2 }),
  enc('kappa_doll', '強', 3, ['shell_kappa', 'vengeful_doll'], { hpScale: 0.94, strength: 2 }),
  enc('owl_trio', '強', 3, ['strategist_owl', 'medicine_bat', 'banner_imp'], { hpScale: 0.88, strength: 2 }),
  enc('three_face_ashura', '大魔物', 3, ['three_face_ashura'], { hpScale: 1.1, strength: 6 }),
  enc('nue', '大魔物', 3, ['nue'], { hpScale: 1.1, strength: 6 }),
  enc('bone_commander', '大魔物', 3, ['bone_commander'], { hpScale: 1.1, strength: 6 }),
  enc('source', '塔主', 3, ['source']),
];
