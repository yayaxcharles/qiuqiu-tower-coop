# -*- coding: utf-8 -*-
"""
pack_hell_art.py — 難度 6「地獄」的 171 張綠幕原圖去背、轉 WebP。**不動任何舊素材、不寫 manifest**。

用法：python tools/pack_hell_art.py [魔物編號 ...]   （不給＝全部；背景每次都重做，很快）

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

manifest 留到接進遊戲那一步再登記：它是開場就載的檔，171 筆約多 12 KB，要跟首載預算一起算。
"""
import re
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from add_sprite import BOX_ASPECT   # noqa: E402
from chroma_key import key_out   # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tools" / "codex_raw"
OUT = ROOT / "public" / "assets"
POSES = ("idle", "attack", "hurt", "block", "down")
SIZE_BY_RAW = {512: "small", 768: "medium", 1024: "large"}


def save(im: Image.Image, dst: Path) -> int:
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=72, method=6)
    return dst.stat().st_size


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    raws: dict[str, dict[str, Path]] = {}
    for f in sorted(RAW.glob("monster_hell_*.png")):
        m = re.match(r"monster_hell_(.+)_(idle|attack|hurt|block|down)$", f.stem)
        if m:
            raws.setdefault(m.group(1), {})[m.group(2)] = f
    only = set(sys.argv[1:])   # 只重做這幾隻（第二批進倉時不用把第一批 168 張再跑一次，逐點去背一輪要十幾分鐘）
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
            total += save(canvas, OUT / "monsters" / f"hell_{mid}_idle.webp"); n += 1
            sizes[mid] = SIZE_BY_RAW.get(Image.open(poses["idle"]).width, "medium")
        base = Image.open(OUT / "monsters" / f"hell_{base_mid}_idle.webp")
        bbox = base.getbbox() or (0, 0, *base.size)
        ch = base.height
        cw = max(base.width, round(ch * BOX_ASPECT[sizes[base_mid]]))
        bottom_pad = ch - bbox[3]
        base_h = bbox[3] - bbox[1]
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
            total += save(canvas, OUT / "monsters" / f"hell_{mid}_{pose}.webp"); n += 1
        print(f"魔物 hell_{mid}（{sizes[base_mid]}）：{'／'.join(sorted(poses))}，畫布 {cw}x{ch}"
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
