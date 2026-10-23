# 難度 6「地獄」接進遊戲 施工計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已生好、已去背的 171 張地獄圖接進遊戲，做出可玩的難度 6：三關三種新機制＋尾王「魔源・紫冥」四階段，難度 1～5 一點都不變。

**Architecture:** 一個 `hellMode` 開關（`difficultyMods(6)`）切換整套地獄內容。地獄魔物與遭遇放在新檔 `src/content/enemies-hell.ts`，併進現有的 `enemies`／`encounters` 陣列，用遭遇上的 `hell: true` 旗標分池；三關機制寫在新檔 `src/engine/hell.ts`，由 `CombatState.hell` 帶著，`combat.ts`／`actions.ts` 只在少數掛點呼叫它。圖片照現行「進關才載」的規矩。

**Tech Stack:** TypeScript、Vite、Vitest；圖檔處理 Python（Pillow）。

**Spec:** `docs/superpowers/specs/2026-10-21-hell-difficulty-design.md`（10-23 改版，尾王段以那份為準）

## Global Constraints

- 不改難度 1～5 的任何內容與數值；機器人量測在難度 1～5 要跟改之前**逐局一致**（Task 0 存基準，Task 2～8 每個收尾都比對）。
- 首載程式 ≤720 KB（`tools/check_size.py`）；地獄的圖只在選了難度 6、進關時才抓。
- 新效果一律用 `cs.rng`（種子亂數），連線兩台結果一致。
- 字最小 15px、以弱電腦為準。
- 新增文字要有繁中、英文、日文三版（`src/i18n/{en,ja}/{ui,content}.json`，對照方式照現有難度名稱「魔塔」那幾行）。
- 改 `combat.ts` 要連帶跑那 30 支讀原始碼的測試；測試比對多行原始碼前先 `.replace(/\r\n/g, '\n')`（本機 `core.autocrlf=true`）。
- 推上線前：tsc 0 錯、全套測試綠、四道門檻（記憶 `feedback_qiuqiu_four_regressions`）、上線前審查子代理；**本機給使用者玩過、說可以才推**；連線版先、單機版 merge 後再推（`sh tools/deploy.sh`）。
- 素材：171 張圖已生完，**不重生、不換、不降畫質**；魔源第三、四階段朝向問題只在 Task 10 試玩時給使用者看，由使用者決定。

## Review Focus

1. **偷來的牌在魔物「不是被打倒」的離場時不見**：魔物逃跑（`escape`）、分裂（`splitInto`，不算打倒）、自爆、戰鬥以其他方式結束——玩家預期牌一定回來。→ Task 5 加測試 `returnsStolenOnEscapeSplitAndCombatEnd`。
2. **手上全是被封的牌**：玩家要能直接結束回合；機器人不能卡在「找不到可出的牌」的迴圈。→ Task 5 加測試 `allSealedHandCanEndTurn`＋smartRun 單場跑完。
3. **看穿的邊界**：第一回合、上一回合沒出牌、攻擊與技能打一樣多 → 都不看穿，意圖牌不掛標記。→ Task 6 加測試 `seeThroughNullOnTieOrNoPlays`。
4. **連線時偷牌目標倒下**：被偷的那位倒下或斷線，魔物被打倒時牌要還給「原主」而不是座位 0。→ Task 5 加測試 `stolenReturnsToOriginalSeat`。
5. **紫霧倒數遇到跳過魔物回合**（先手香 `skipEnemyTurn`、定身）：倒數照「回合」算、不因魔物沒動而停或多扣。→ Task 4 加測試 `miasmaTicksOncePerRoundEvenWhenEnemyTurnSkipped`。

---

### Task 0：難度 1～5 機器人基準

**Files:**
- Create: `tools/perf/hell_baseline.mjs`（或同等的 vitest 慢測，照專案現有量測腳本的寫法）
- Create: `tests/fixtures/bot_baseline_d1to5.json`

- [ ] **Step 1**：寫腳本跑 `smartRun('base-<i>', d, hero)`，d＝1～5、四隻貓、`i` 從 0 起，每組先跑 20 局；量一次耗時，總時間超過 3 分鐘就把局數降到 10。每局存 `{seed, d, hero, won, floor, act, deckSize}`。
- [ ] **Step 2**：跑一次存成 fixture；再跑一次確認兩次輸出逐字相同（不同就是量測本身不穩，先回報）。
- [ ] **Step 3**：提交 `測試：難度 1～5 機器人基準（地獄施工前）`。

### Task 1：難度表加第 6 級

**Files:**
- Modify: `src/content/difficulty.ts`
- Modify: `src/i18n/en/content.json`、`src/i18n/ja/content.json`、`src/i18n/en/ui.json`、`src/i18n/ja/ui.json`
- Test: `tests/engine/difficulty.test.ts`

**Interfaces:**
- Produces: `MAX_DIFFICULTY = 6`；`DifficultyMods.hellMode: boolean`（`d >= 6`）；`DIFFICULTY_NAMES[5] = '地獄'`。

- [ ] **Step 1：改測試**：`unlockedDifficulty()` 的三個 `toBe(5)` 改 `toBe(MAX_DIFFICULTY)`；新增：
```ts
it('難度 6 繼承 5 的全部懲罰並打開地獄', () => {
  const m5 = difficultyMods(5), m6 = difficultyMods(6);
  expect(m6).toEqual({ ...m5, hellMode: true });
  expect(m5.hellMode).toBe(false);
});
```
- [ ] **Step 2**：`npx vitest run tests/engine/difficulty.test.ts` → FAIL。
- [ ] **Step 3**：實作。說明文字固定為：`'三關各考一種難：紫霧倒數逼你速戰、魔物偷牌封牌打亂牌組、魔物互相配合並看穿你的打法；塔底的魔源有四個形態。'`；英日譯文照這句意思翻、放進 ui.json，`地獄` 放進 content.json（英 `Hell`、日 `地獄`）。標題與大廳的按鈕是照 `MAX_DIFFICULTY` 迴圈長的，不用改；若六顆按鈕在 1280 寬排不下，縮按鈕間距，不換行。
- [ ] **Step 4**：同一支測試 PASS；`npx tsc --noEmit` 0 錯。
- [ ] **Step 5**：提交。

### Task 2：地獄魔物資料與分池

**Files:**
- Create: `src/content/enemies-hell.ts`
- Modify: `src/engine/types.ts`（`EncounterDef` 加 `hell?: true`）
- Modify: `src/content/enemies.ts:1282`、`:1508-1512`（併入、`encountersOfPool` 加參數）
- Modify: `src/engine/run.ts:31-37`（`bossPoolForAct`）、`:69`、`:644`、`beginCombat`
- Modify: `src/engine/map.ts`（`generateMap` 的 opts、`:368-388` 抽遭遇、`:444` 驗證）
- Modify: 問號格開戰抽遭遇的地方（`grep -n "encountersOfPool" src/engine` 找齊）
- Modify: `src/i18n/{en,ja}/content.json`（36 個名字＋台詞）
- Test: `tests/engine/hell-pool.test.ts`

**Interfaces:**
- Produces:
  - `export const hellEnemies: EnemyDef[]`、`export const hellEncounters: EncounterDef[]`（`enemies-hell.ts`）
  - `encountersOfPool(pool: EnemyPool, act?: number, hell = false): EncounterDef[]`——`hell` 為假時濾掉 `e.hell`，為真時只留 `e.hell`。
  - `bossPoolForAct(act: number, hell = false): string[]`——地獄：1→`['hell_hourglass_shogun']`、2→`['hell_hoarder_toad']`、3→`['hell_source']`。
  - `generateMap(rng, { ...現有, hell?: boolean })`
- 魔物編號＝`hell_<工單名>`，`art`＝`codex/monster_hell_<工單名>`，名單與分關照 `tools/make_hell_jobs.py` 的三段註解：
  - 第一關一般：fuse_imp、hourglass_moth、loot_weasel、drum_tanuki、onibi_rats、candle_monk、fire_wheel、miasma_bud；大魔物：clock_oni、rush_boar、sand_golem；關主：hourglass_shogun
  - 第二關一般：pickpocket_monkey、ofuda_ghost、magpie_tengu、junk_mimic、ink_octopus、lock_spider、shuffle_fox、trash_goblin；大魔物：vault_tortoise、card_dragon、chain_warden；關主：hoarder_toad
  - 第三關一般：shell_kappa、banner_imp、medicine_bat、twin_moon、twin_sun、mirror_eye、strategist_owl、smoke_rat；大魔物：three_face_ashura、nue、bone_commander；關主：source（四階段，Task 7 填）
  - `size` 必須等於 `tools/pack_hell_art.py` 印出的體型表（原圖 512＝small、768＝medium、1024＝large），不然框的長寬比對不上。
- 這一步的招式只用**現有**效果（`damage`、`block`、`statusPlayer`、`summon`、`giveCard`、`discardRandomHand`、`escape`、`selfDestruct`、`blockAllies`、`statusAllies`…），血量照同關同池現有魔物的量級；新機制的招式由 Task 4～7 補上。遭遇一律 `hell: true`、`acts: [n]`；每關弱／中／強都要有單隻與組合，第三關的組合至少一半是兩隻以上同場。

- [ ] **Step 1：寫測試**（`hell-pool.test.ts`）：
  - `normalPoolsExcludeHell`：`encountersOfPool(p, a)` 對所有池與關數都不含 `hell` 遭遇。
  - `hellPoolsOnlyHell`：`encountersOfPool(p, a, true)` 非空（池＝弱中強大魔物、a＝1～3）且全是 `hell`。
  - `hellMapUsesHellEncounters`：`generateMap(new Rng(seedFromString('h1')), { act, hell: true, bossIds: bossPoolForAct(act, true) })` 每個戰鬥、大魔物、塔主節點的遭遇都是 `hell`；地圖驗證（`map.ts` 的檢查函式）回空陣列。
  - `everyHellEnemyHasArtKeyAndSize`：36 個魔物的 `art` 都在 `public/assets/manifest.json` 的 `monsters` 裡（Task 3 才登記，這條先標 `it.todo`，Task 3 打開）。
- [ ] **Step 2**：跑 → FAIL。
- [ ] **Step 3**：實作。`beginCombat` 與兩處 `generateMap` 從 `runMods(run).hellMode` 取 `hell`；問號格的戰鬥照設計文件也改抽地獄池，事件劇本指定的對手不動。
- [ ] **Step 4**：測試 PASS；跑 Task 0 的基準腳本比對 fixture，**逐局相同**（不同代表動到了難度 1～5 的亂數順序，要修到相同）。
- [ ] **Step 5**：提交。

### Task 3：地獄圖片進倉、預載與背景

**Files:**
- Modify: `tools/pack_hell_art.py`（加 `--register`：把 `hell_*` 魔物圖與 `bg/bg_hell_*` 寫進 manifest，鍵照現有格式 `codex/monster_hell_<id>` → `{pose: 路徑}`、`bg/bg_hell_<n>`）
- Modify: `src/ui/preload.ts:41-68`（`enemyIdsForAct`、`monsterArtKeysForAct` 加 `hell` 參數）、`preloadAct`
- Modify: `src/ui/bgacts.ts`（地獄背景鍵併進 `deferredBgKeys`，地獄時戰鬥背景用 `bg/bg_hell_<act>`）
- Modify: 地圖畫面加紫黑色調（在現有地圖容器加一個 class，CSS 一段濾鏡或疊色；只在 hellMode）
- Test: `tests/ui/hell-assets.test.ts`；打開 Task 2 的 `it.todo`

**Interfaces:**
- Consumes: Task 2 的 `hellEnemies`、`bossPoolForAct(act, hell)`。
- Produces: `enemyIdsForAct(act: number, hell = false): Set<string>`；`hellBgKey(act: number): string`（回 `bg/bg_hell_<act>`）。

- [ ] **Step 1：寫測試**：`hellArtNotInFirstLoad`（`deferredBgKeys()` 含三張 `bg/bg_hell_*`；開場預載清單不含任何 `hell_`）；`preloadActHellOnlyHellArt`（`enemyIdsForAct(1, true)` 全是 `hell_` 開頭、`enemyIdsForAct(1)` 一個都沒有）；`sourcePhasesPreloaded`（`monsterArtKeysForAct(3, true)` 含 `codex/monster_hell_source_p2`～`_p4`）。
- [ ] **Step 2**：跑 → FAIL。
- [ ] **Step 3**：`python tools/pack_hell_art.py --register` 寫 manifest，再實作預載與背景。
- [ ] **Step 4**：測試 PASS；`python tools/check_size.py` 首載程式 ≤720 KB，把 manifest 增加的位元組數寫進提交訊息。
- [ ] **Step 5**：提交。

### Task 4：第一關「快」——紫霧倒數

**Files:**
- Create: `src/engine/hell.ts`
- Modify: `src/engine/types.ts`（`CombatState.hell?: HellState`）
- Modify: `src/engine/combat.ts:22-40`（`startCombat` 收 `hell?: { act: 1 | 2 | 3 }`）、`:446`（抽牌數）、敵方回合結束處
- Modify: `src/engine/run.ts` `beginCombat`（地獄時傳 `hell: { act: run.act }`）
- Modify: `src/ui/screens/combat.ts`（倒數數字，放在現有回合數旁邊，用現有樣式）
- Test: `tests/engine/hell-miasma.test.ts`

**Interfaces:**
- Produces（`hell.ts`）：
```ts
export interface HellState {
  act: 1 | 2 | 3;
  miasmaLeft?: number;                 // 只有第一關（與魔源第一形態）有；0＝已歸零
  sealNext?: 'attack' | 'skill';       // Task 5
  sealed?: 'attack' | 'skill';         // Task 5
  lastPlays?: { attack: number; skill: number };  // Task 6
  seeThrough?: 'attack' | 'skill' | null;          // Task 6
}
export const MIASMA_TURNS: Record<'normal' | 'elite' | 'boss', number>;  // 起始值 { normal: 6, elite: 8, boss: 10 }，量測再調
export function initHell(cs: CombatState, act: 1 | 2 | 3): void;
export function miasmaTick(cs: CombatState): void;   // 每一輪結束呼叫一次
export function hellDrawPenalty(cs: CombatState): number;  // 紫霧歸零回 1，否則 0
```
- 規則（照設計文件）：歸零後每一輪所有活著的魔物 +2 爪力（累加，走現有爪力狀態、頭上會掛牌子）；玩家抽牌固定少 1（5→4，不累加）。

- [ ] **Step 1：寫測試**：`countdownByPool`（一般／大魔物／關主的起始倒數＝`MIASMA_TURNS`）；`afterZeroEnemiesGain2ClawEachRound`（歸零後連兩輪，爪力 +2、+4）；`afterZeroDrawFour`；`miasmaTicksOncePerRoundEvenWhenEnemyTurnSkipped`（Review Focus 5）；`act2NoMiasma`。
- [ ] **Step 2**：跑 → FAIL。
- [ ] **Step 3**：實作 `hell.ts` 與三個掛點；倒數歸零那一輪寫一行戰報（三語）。
- [ ] **Step 4**：測試 PASS；30 支讀原始碼的測試照樣綠；Task 0 基準逐局相同。
- [ ] **Step 5**：提交。

### Task 5：第二關「亂」——偷牌、封牌

**Files:**
- Modify: `src/engine/types.ts`（`EnemyEffect` 加兩種；`EnemyCombat.stolen?: { seat: number; card: CardInstance }[]`）
- Modify: `src/engine/actions.ts`（執行兩種效果；魔物離場時還牌）
- Modify: `src/engine/combat.ts:477`（`canPlay` 加封牌檢查）、玩家回合開始（`sealNext`→`sealed`）、回合結束（清 `sealed`）
- Modify: `src/engine/hell.ts`（`returnStolen(cs, e)`）
- Modify: `src/content/enemies-hell.ts`（第二關每隻至少一種「亂」：偷牌、封牌、或現有的 `giveCard`／`discardRandomHand`）
- Modify: `src/ui/screens/combat.ts`（魔物身上顯示偷了哪張；被封的牌變灰並寫原因；意圖牌預告封哪一類）
- Test: `tests/engine/hell-chaos.test.ts`

**Interfaces:**
- Produces：
  - `{ kind: 'stealCard'; n: number }`：從**這招瞄準的那位**手牌隨機拿 n 張，存進 `e.stolen`；手牌空就不做事。
  - `{ kind: 'sealType'; type: 'attack' | 'skill' }`：設 `cs.hell.sealNext`；下一個玩家回合那類牌全部 `canPlay` 回 `{ ok: false, reason: '被封住了，這回合打不出攻擊牌'／'…技能牌' }`。能力牌不封；連線兩位一起封。
  - `returnStolen(cs: CombatState, e: EnemyCombat): void`：牌還回原主的手牌（滿 10 張改進棄牌堆），清空 `e.stolen`。呼叫點：魔物被打倒、逃跑、分裂、自爆、戰鬥結束（任何方式）。

- [ ] **Step 1：寫測試**：`stealTakesFromTargetHand`；`stealOnEmptyHandNoop`；`returnsOnDefeat`；`returnsStolenOnEscapeSplitAndCombatEnd`（Review Focus 1）；`stolenReturnsToOriginalSeat`（Review Focus 4，用 `cs.players` 兩位）；`sealBlocksTypeNextTurnOnly`；`sealNeverBlocksPower`；`allSealedHandCanEndTurn`（Review Focus 2：手牌全是被封的類別時，`endTurn` 正常、`smartRun('seal-0', 6, 'ninja')` 跑完不逾時）。
- [ ] **Step 2**：跑 → FAIL。
- [ ] **Step 3**：實作；機器人與介面都走 `canPlay`，不另寫判斷。
- [ ] **Step 4**：測試 PASS；Task 0 基準逐局相同。
- [ ] **Step 5**：提交。

### Task 6：第三關「狡猾」——看穿與配合

**Files:**
- Modify: `src/engine/hell.ts`（記錄出牌、算看穿、減半）
- Modify: `src/engine/combat.ts`（出牌時記 `lastPlays`；玩家回合開始算 `seeThrough`）
- Modify: `src/engine/actions.ts`（對魔物的攻擊傷害、玩家技能給的蜷縮、對魔物上的減益層數，在看穿時減半）
- Modify: `src/engine/types.ts`（`EnemyDef` 加 `enrageOnAllyDeath?: number`、`taunt?: true`）
- Modify: `src/content/enemies-hell.ts`（第三關魔物：至少兩隻 `taunt`、兩隻 `enrageOnAllyDeath`、其餘用現有的 `blockAllies`／`statusAllies`／`heal` 互相補）
- Modify: `src/ui/screens/combat.ts`（意圖牌上「看穿：攻擊／技能」；`taunt`、`enrageOnAllyDeath` 照「隱藏機制全部掛牌可見」掛牌子）
- Test: `tests/engine/hell-cunning.test.ts`

**Interfaces:**
- Produces：
  - `recordPlay(cs: CombatState, type: CardType): void`（能力牌不記）
  - `computeSeeThrough(cs: CombatState): void`——上一回合攻擊多→`'attack'`、技能多→`'skill'`、平手或都 0→`null`；只看這場戰鬥的上一回合，算完清 `lastPlays`；連線兩位合計。
  - `seeThroughScale(cs: CombatState, type: 'attack' | 'skill'): number`——被看穿回 0.5，否則 1；乘完無條件捨去、最少 1（傷害 0 的維持 0）。
  - `taunt`：活著時，玩家單體攻擊打其他魔物一律改打牠（全體、亂數不受影響）。
  - `enrageOnAllyDeath: n`：同伴被打倒時牠 +n 爪力。
- 只在 `cs.hell.act === 3`（或魔源第三、四形態）生效。

- [ ] **Step 1：寫測試**：`seeThroughAttackHalvesDamage`；`seeThroughSkillHalvesBlockAndDebuff`；`powerCardsIgnored`；`seeThroughNullOnTieOrNoPlays`（Review Focus 3，含第一回合）；`coopPlaysSummed`；`tauntRedirectsSingleTarget`；`enrageOnAllyDeath`；`act1NoSeeThrough`。
- [ ] **Step 2**：跑 → FAIL。
- [ ] **Step 3**：實作。
- [ ] **Step 4**：測試 PASS；Task 0 基準逐局相同。
- [ ] **Step 5**：提交。

### Task 7：尾王「魔源・紫冥」四階段

**Files:**
- Modify: `src/content/enemies-hell.ts`（`hell_source`：`phases` 三條 `hpBar`）
- Modify: `src/engine/types.ts`（`EnemyPhase` 加 `hellMech?: ('miasma' | 'chaos' | 'cunning')[]`、`learnsPlayerCards?: true`；`EnemyDef` 加同名的 `hellMech`）
- Modify: `src/engine/hell.ts`（目前生效的機制＝關數給的 ∪ 這隻當下形態的 `hellMech`）
- Modify: `src/engine/mimic.ts:187`（`learnsPlayerCards(e)` 也看當下形態）
- Modify: `src/engine/actions.ts:691` 附近（換形態時先 `returnStolen`）
- Modify: `src/engine/coopscale.ts:94-96`（`COOP_HP_BY_ENCOUNTER` 加 `hell_source`，起始照 `tower_master` 的 `[1, 2.4, 3.6]`，Task 9 量）
- Modify: `src/content/dialogue.ts`（開場、三次換形態、落敗台詞；結局加一句交代封印補回去、師父為什麼走火入魔）
- Modify: `src/i18n/{en,ja}/content.json`
- Test: `tests/engine/hell-source.test.ts`

**Interfaces:**
- Consumes: Task 4～6 的 `HellState`、`returnStolen`、`seeThroughScale`、`stealCard`、`sealType`。
- 四形態（設計文件「尾王」段）：
  1. 紫霧之繭：`hellMech: ['miasma']`，倒數用 `MIASMA_TURNS.boss − 2`（比一般關主短）。
  2. 破繭・千手：`['chaos']`，招式含 `stealCard`、`sealType`、`giveCard`。
  3. 千面：`['cunning']`，`chooseMove` 照回合輪換三張「面具」招式（每張一種主招），每三回合 `summon` 一隻第三關小怪（`max: 2`）。
  4. 真身・九尾黑貓神：`['miasma', 'chaos', 'cunning']`＋`learnsPlayerCards: true`；倒數重新起算。只有這形態有倒下圖。
- 換圖走現有 `monsterPhaseKey`（`codex/monster_hell_source` → `_p2`～`_p4`），不用改 `assets.ts`。

- [ ] **Step 1：寫測試**：`fourFormsViaHpBar`（打完三條血才倒）；`phase1HasMiasmaInAct3`；`phase2StealsAndSeals`；`phaseChangeReturnsStolen`；`phase3RotatesMasksAndSummonsMax2`；`phase4MimicsLastTurnAndAllMechs`；`runWinsAfterSource`（打倒魔源＝通關，走跟打倒師父同一條結局路徑，`grep -n "tower_master" src` 的 25 處逐一確認哪些要認 `hell_source`）。
- [ ] **Step 2**：跑 → FAIL。
- [ ] **Step 3**：實作；台詞先寫好放進檔案，Task 10 給使用者看。
- [ ] **Step 4**：測試 PASS；Task 0 基準逐局相同。
- [ ] **Step 5**：提交。

### Task 8：機器人量測與調整

**Files:**
- Create: `tools/perf/hell_measure.mjs`
- Modify: `src/content/enemies-hell.ts`、`src/engine/hell.ts`（只調數字）、`src/engine/coopscale.ts`

- [ ] **Step 1**：`smartRun('hell-<i>', 6, hero)` 四隻貓各 200 局、`coopRun('hellc-<i>', 6, [a, b])` 100 局；同批種子跑難度 5 當對照。輸出：平均樓層、到各關比例、三位關主勝率（以「打到牠」為條件）。
- [ ] **Step 2**：三種機制各開／關跑一批，確認沒有哪一關變成牆（某關主勝率 0）。
- [ ] **Step 3**：照停止規則調：第一關關主 20～40%、第二關關主 15～30%、魔源 10～25%，四隻貓平均樓層都低於難度 5；達到就停。
- [ ] **Step 4**：量測表（難度 5 對照地獄）存進 `docs/superpowers/plans/2026-10-23-hell-measure.md`；Task 0 基準逐局相同。
- [ ] **Step 5**：提交。

### Task 9：驗收與本機試玩

- [ ] **Step 1**：`npx tsc --noEmit` 0 錯；`npm test` 全綠；`python tools/check_size.py` 首載 ≤720 KB。
- [ ] **Step 2**：四道門檻，每批跟線上舊版比對。
- [ ] **Step 3**：派上線前審查子代理（記憶 `feedback_post_release_agent_audit`），修完再跑 Step 1。
- [ ] **Step 4**：本機開預覽，`--uitest` 或手動截圖：三關各一場、魔源四形態各一張，挑可疑的看全解析度（記憶 `feedback_image_review_quota`）。三個標記（倒數、封牌、看穿）同時出現時不能疊在一起。
- [ ] **Step 5**：交給使用者試玩；同時請使用者看魔源第三、四形態的朝向、魔源台詞。**使用者說可以才推**（連線版先、單機版 merge 後 `sh tools/deploy.sh`）。
