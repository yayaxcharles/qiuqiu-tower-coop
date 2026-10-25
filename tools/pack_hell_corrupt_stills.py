"""地獄結局「師父被魔氣纏住」補圖進倉（2026-10-25，Codex 生、tools/codex_raw/hell_corrupt_1025/）。

噹噹、封封單人，以及五組不同角色連線配對，各一張 16:9 全幅場景：照 pack_fengfeng_missing_story_art.py
同一做法，等比縮到 1280×720、WebP 85（94 會到 300 KB，是其他劇情圖的兩倍）。manifest 不用 manifest_io.merge（它會把整份重排），7 行是手動插在 bg 段 still_corrupt 後面。已存在且內容不同的輸出不覆蓋。
用法：python tools/pack_hell_corrupt_stills.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tools" / "codex_raw" / "hell_corrupt_1025"
NAMES = [
    "dangdang_still_corrupt",
    "fengfeng_still_corrupt",
    "dangdang_coop_ninja_corrupt",
    "dangdang_coop_feifei_corrupt",
    "fengfeng_coop_ninja_corrupt",
    "fengfeng_coop_feifei_corrupt",
    "fengfeng_coop_dangdang_corrupt",
]


def main() -> int:
    for name in NAMES:
        src = SRC / f"{name}.png"
        with Image.open(src) as im:
            w, h = im.size
            if abs(w / h - 16 / 9) > 0.002:
                raise SystemExit(f"{src.name} 不是 16:9（{w}×{h}），不收")
            buf = io.BytesIO()
            im.convert("RGB").resize((1280, 720), Image.LANCZOS).save(buf, "WEBP", quality=85, method=6)
        out = ROOT / "public" / "assets" / "bg" / f"{name}.webp"
        data = buf.getvalue()
        if out.exists() and out.read_bytes() != data:
            raise SystemExit(f"{out} 已存在且內容不同，不覆蓋")
        out.write_bytes(data)
        print(f"{name}: {len(data) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
