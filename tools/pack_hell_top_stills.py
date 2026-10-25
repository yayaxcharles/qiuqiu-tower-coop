"""地獄塔頂段插圖進倉（2026-10-25，Codex 生）：單人 4 張（tools/codex_raw/hell_top_1025/）＋連線 6 組（hell_top_coop_1025/）。

同 pack_hell_corrupt_stills.py：16:9 全幅等比縮到 1280×720、WebP 85；已存在且內容不同的輸出不覆蓋。
manifest 不用 manifest_io.merge（它會把整份重排），條目由呼叫端手動插在 bg 段。
用法：python tools/pack_hell_top_stills.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tools" / "codex_raw"
SOURCES = {
    "hell_top_1025": ["still_hell_top", "feifei_still_hell_top", "dangdang_still_hell_top", "fengfeng_still_hell_top"],
    "hell_top_coop_1025": ["feifei_coop_ninja_hell_top", "dangdang_coop_ninja_hell_top", "dangdang_coop_feifei_hell_top",
                           "fengfeng_coop_ninja_hell_top", "fengfeng_coop_feifei_hell_top", "fengfeng_coop_dangdang_hell_top"],
}


def main() -> int:
    for folder, names in SOURCES.items():
        for name in names:
            src = RAW / folder / f"{name}.png"
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
