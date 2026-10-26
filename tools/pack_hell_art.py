# -*- coding: utf-8 -*-
"""
pack_hell_art.py — 難度 6「地獄」的綠幕原圖去背、轉 WebP。**不動任何舊素材**；預設不寫 manifest，加 `--register` 才寫。

用法：python tools/pack_hell_art.py [--small-width=N] [魔物編號 ...]   （不給＝全部；背景每次都重做，很快）
      --small-width=N  小型魔物（原圖 512）整隻縮到畫布最大寬 N（預設 320；0＝不縮）；同一隻各姿勢同一倍率
      python tools/pack_hell_art.py --register     只把倉裡現有的 hell_*.webp、bg_hell_*.webp 登記進 manifest 就結束
                                                   （不重跑去背、不碰圖；可重跑，只覆寫自己的鍵）

  魔物  tools/codex_raw/monster_hell_<id>_<姿勢>.png → public/assets/monsters/hell_<id>_<姿勢>.webp
  背景  tools/codex_raw/bg_hell_<關>[_2|_3].png → public/assets/bg/同名.webp（每關三張）
        原稿已是 1280x720（照 art26_low/mid/top_1 構圖生的），不裁；品質 85 照 add_art26_bg.py 的規矩。

魔物的對齊規則照 add_sprite.py（不是 build_art_inbox.py 的「各姿勢取最大值當共用畫布」）：
  1. 待機圖自己一張畫布（去背裁到主體、留 8 像素邊、縮到 460x560 以內、品質 72）。
  2. 其他姿勢：畫布高度＝待機畫布高度、寬度放到遊戲框的長寬比；主體比畫布大才等比縮，貼底置中。
  3. 換階段的形態（source_p2…p4）全部照**第一形態** hell_source 的待機畫布貼，換階段那一刻才不會忽大忽小。
  第一版用的是第 1 種寫法的共用畫布，結果出事：防禦姿勢的原圖一律是 1024，其他姿勢是 512／768，
  共用畫布被防禦那張撐到兩倍大，待機縮成一半、換到防禦又大一倍（10-23 縮圖總覽看出來的）。

遊戲框大小照原圖解析度推（工單 tools/make_hell_jobs.py 就是照體型給尺寸的）：1024＝large、768＝medium、512＝small。
接進 enemies.ts 時 size 要跟這張表一致，不然框的長寬比對不上。

manifest 用 `--register` 登記（2026-10-24 Task 3）：它是開場就載的檔，要跟首載預算一起算。
  魔物鍵 codex/monster_hell_<id> → {姿勢: assets/monsters/hell_<id>_<姿勢>.webp}；換階段的 hell_source_p2～p4 各自一個鍵
  （`monsterPhaseKey` 查 `<原鍵>_p<階段>`）；背景鍵 bg/bg_hell_<關>、bg/bg_hell_<關>_2、_3。
"""
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from add_sprite import BOX_ASPECT   # noqa: E402
from chroma_key import key_out   # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ["QIUQIU_RAW_DIR"]) if os.environ.get("QIUQIU_RAW_DIR") else ROOT / "tools" / "codex_raw"   # 原圖不進版控；工作副本用環境變數指向主資料夾那份（只讀）
OUT = ROOT / "public" / "assets"
POSES = ("idle", "attack", "hurt", "block", "down")
SIZE_BY_RAW = {512: "small", 768: "medium", 1024: "large"}
# 小型魔物在 1920x1080 只顯示約 195 寬，原本畫布 460 寬解碼記憶體浪費約 5 倍（10-26 效能量測）；
# 縮到 320 寬（仍有 1.6 倍餘裕）。中型、大型、關主、魔源不縮。
SMALL_MAX_W = 320


MANIFEST = OUT / "manifest.json"


def register() -> None:
    """把倉裡現有的地獄圖寫進 manifest：只加／覆寫 codex/monster_hell_* 與 bg/bg_hell_*，其他鍵與位元組順序不動；換行維持檔案原本的（CRLF 或 LF）"""
    raw = MANIFEST.read_bytes().decode("utf-8")
    crlf = "\r\n" in raw
    manifest = json.loads(raw)
    found: dict[str, dict[str, str]] = {}
    for f in sorted((OUT / "monsters").glob("hell_*.webp")):
        m = re.match(r"hell_(.+)_(idle|attack|hurt|block|down)$", f.stem)
        if m:
            found.setdefault(m.group(1), {})[m.group(2)] = f.relative_to(OUT.parent).as_posix()
    for mid in sorted(found):
        manifest["monsters"][f"codex/monster_hell_{mid}"] = {p: found[mid][p] for p in POSES if p in found[mid]}
    bgs = sorted((OUT / "bg").glob("bg_hell_*.webp"))
    for f in bgs:
        manifest["bg"][f"bg/{f.stem}"] = f.relative_to(OUT.parent).as_posix()
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if crlf:
        text = text.replace("\n", "\r\n")
    MANIFEST.write_bytes(text.encode("utf-8"))
    print(f"manifest 已登記：魔物 {len(found)} 組（{sum(len(v) for v in found.values())} 張）、背景 {len(bgs)} 張")


def save(im: Image.Image, dst: Path) -> int:
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=72, method=6)
    return dst.stat().st_size


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    if "--register" in sys.argv[1:]:
        register()
        return
    raws: dict[str, dict[str, Path]] = {}
    for f in sorted(RAW.glob("monster_hell_*.png")):
        m = re.match(r"monster_hell_(.+)_(idle|attack|hurt|block|down)$", f.stem)
        if m:
            raws.setdefault(m.group(1), {})[m.group(2)] = f
    args = sys.argv[1:]
    small_w = SMALL_MAX_W
    for a in list(args):
        if a.startswith("--small-width="):   # 小型魔物的畫布最大寬度；0＝不縮（回到 460 寬原樣）
            small_w = int(a.split("=", 1)[1]); args.remove(a)
    idle_canvas: dict[str, Image.Image] = {}
    only = set(args)   # 只重做這幾隻（第二批進倉時不用把第一批 168 張再跑一次，逐點去背一輪要十幾分鐘）
    if only:
        raws = {k: v for k, v in raws.items() if k in only}
    n = total = 0
    sizes: dict[str, str] = {}
    short: list[str] = []
    # 第一形態先做，換階段的形態要拿它的待機畫布
    for mid in sorted(raws, key=lambda k: (re.sub(r"_p\d+$", "", k), k)):
        poses = raws[mid]
        base_mid = re.sub(r"_p\d+$", "", mid)
        if mid == base_mid:
            idle = key_out(Image.open(poses["idle"]))
            pad = 8
            canvas = Image.new("RGBA", (idle.width + pad * 2, idle.height + pad * 2), (0, 0, 0, 0))
            canvas.paste(idle, (pad, pad), idle)
            canvas.thumbnail((460, 560), Image.LANCZOS)
            idle_canvas[mid] = canvas
            sizes[mid] = SIZE_BY_RAW.get(Image.open(poses["idle"]).width, "medium")
        # 待機畫布留在記憶體裡（沒做這一隻的待機、只重做換階段形態時才讀倉裡的檔）；縮小在存檔那一步才做
        base = idle_canvas.get(base_mid) or Image.open(OUT / "monsters" / f"hell_{base_mid}_idle.webp")
        bbox = base.getbbox() or (0, 0, *base.size)
        ch = base.height
        cw = max(base.width, round(ch * BOX_ASPECT[sizes[base_mid]]))
        bottom_pad = ch - bbox[3]
        base_h = bbox[3] - bbox[1]
        # 小型魔物整隻縮小：同一隻所有姿勢（含待機）乘同一個倍率，姿勢之間的相對大小不變；
        # 倍率照共用畫布寬 cw 算（cw＝每個姿勢畫布的寬，待機比它窄時待機會小於 small_w，這是對的）
        shrink = min(1.0, small_w / cw) if (small_w and sizes[base_mid] == "small") else 1.0

        def put(name: str, img: Image.Image) -> int:
            if shrink < 1.0:
                img = img.resize((max(1, round(img.width * shrink)), max(1, round(img.height * shrink))), Image.LANCZOS)
            return save(img, OUT / "monsters" / f"hell_{mid}_{name}.webp")

        if mid == base_mid:
            total += put("idle", base); n += 1
        for pose, src in sorted(poses.items()):
            if mid == base_mid and pose == "idle":
                continue
            im = key_out(Image.open(src))
            max_w, max_h = cw - 2, ch - bottom_pad
            if im.width > max_w or im.height > max_h:
                k = min(max_w / im.width, max_h / im.height)
                im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            if pose in ("attack", "block") and im.height < base_h * 0.9:
                short.append(f"hell_{mid}_{pose}：只有待機的 {im.height / base_h:.0%} 高")
            canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            canvas.paste(im, ((cw - im.width) // 2, ch - bottom_pad - im.height), im)
            total += put(pose, canvas); n += 1
        print(f"魔物 hell_{mid}（{sizes[base_mid]}）：{'／'.join(sorted(poses))}，畫布 {cw}x{ch}"
              + (f"，縮成 {round(cw * shrink)}x{round(ch * shrink)}（×{shrink:.3f}）" if shrink < 1.0 else "")
              + ("" if mid == base_mid else f"，照 hell_{base_mid} 對齊"))
    # 每關三張：bg_hell_<關>（第一批）、bg_hell_<關>_2、_3（第二批）；舊版留底的 *.prev-*.png 檔名有「.」，不收
    for src in sorted(RAW.glob("bg_hell_*.png")):
        if "." in src.stem:
            continue
        dst = OUT / "bg" / f"{src.stem}.webp"
        Image.open(src).convert("RGB").save(dst, "WEBP", quality=85, method=6)
        n += 1; total += dst.stat().st_size
        print(f"背景 {dst.name} {dst.stat().st_size // 1024} KB")
    print(f"完成 {n} 張，共 {total / 1024 / 1024:.2f} MB")
    print("體型：" + "、".join(f"{k}={v}" for k, v in sorted(sizes.items())))
    if short:
        print("出手／防禦比待機矮一成以上（遊戲裡看起來變小，要看圖決定）：\n  " + "\n  ".join(short))


if __name__ == "__main__":
    main()
