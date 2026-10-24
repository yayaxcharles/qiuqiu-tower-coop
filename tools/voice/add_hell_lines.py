# -*- coding: utf-8 -*-
r"""把地獄（難度 6）新增的配音台詞併進 tools/voice/script.json（不呼叫任何語音服務、不動既有群組與既有句子）。

資料來源：
- tools/voice/lines_zh_hell.json：dump_lines_hell.ts 實跑盤出的「地獄才有」的句子（說話者、畫面中文、出現場景）
- src/i18n/ja/lines.json：日文台詞（鍵＝畫面中文，跟遊戲同一份）
- tools/voice/ja/hell.json：每句送去念的寫法 tts（難讀漢字改假名，規則同 build_script.py 的譯名表）
鍵＝「聲音角色|畫面上的中文」；script.json 已經有的鍵直接沿用既有音檔、不重生。

用法（系統 Python，在專案資料夾）：python tools\voice\add_hell_lines.py
"""
import hashlib, json, re, sys
from collections import OrderedDict
from pathlib import Path

import pykakasi

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
VD = ROOT / "tools" / "voice"
EACH = "Each line is a separate line of dialogue; leave about one second of silence between lines. Natural Tokyo Japanese, anime style."

S = json.loads((VD / "script.json").read_text(encoding="utf-8"), object_pairs_hook=OrderedDict)
Z = json.loads((VD / "lines_zh_hell.json").read_text(encoding="utf-8"))["lines"]
JA = json.loads((ROOT / "src" / "i18n" / "ja" / "lines.json").read_text(encoding="utf-8"))
TTS = {(t["speaker"], t["zh"]): t["tts"] for t in json.loads((VD / "ja" / "hell.json").read_text(encoding="utf-8"))}
kks = pykakasi.kakasi()

NEW_GROUPS = {
    "hell_source": OrderedDict(
        role="hell_source", name="魔源・紫冥（地獄尾王）", name_ja="魔源・紫冥", lang="ja", voice="umbriel", split="align", lufs=-15,
        why="Umbriel（隨性、放鬆的低沉男聲）→ 封在塔底太久、疲憊而不是凶惡的古老妖物；沒有被其他群組用過，也跟低音的大俠貓（storyteller-4）、龍貓（charon）、機關貓（algenib）分得開",
        style="An ancient sealed yokai at the bottom of the tower, the source of the purple miasma. It has been shut away for ages and is "
              "weary rather than villainous: no shouting, no menace, only a tired, sorrowful calm. Very low, hoarse, old-man voice. "
              "It speaks slowly, in short broken phrases with long pauses, and calls itself 'washi'. "
              "Its last line is quiet and heartbreaking, like a long-held breath finally let go. " + EACH),
}
for g, v in NEW_GROUPS.items():
    S["groups"].setdefault(g, v)


def reading(tts):
    s = "".join(x["hira"] for x in kks.convert(tts))
    return re.sub(r"[！？!?。…～〜―—「」『』（）()\s]+", "", s).strip("、")


have = {l["key"] for l in S["lines"]}
added, reused = [], []
for z in Z:
    sp, zh = z["speaker"], z["text"]
    key = f"{sp}|{zh}"
    if key in have:
        reused.append(key)
        continue
    assert zh in JA, f"日文缺：{zh}"
    assert (sp, zh) in TTS, f"tts 缺：{key}"
    g = S["groups"][sp]
    line = OrderedDict(
        id=f"{sp}_{hashlib.sha1(key.encode('utf-8')).hexdigest()[:8]}", group=sp, role=g["name"], lang="ja",
        text=zh, zh=zh, ja=JA[zh], tts=TTS[(sp, zh)], reading=reading(TTS[(sp, zh)]), key=key, tier="story",
        event=z["ctx"], batch=f"{sp}/hell")
    S["lines"].append(line)
    added.append(line)

by = OrderedDict()
for l in added:
    b = by.setdefault(l["batch"], {"group": l["group"], "lines": 0, "chars": 0, "tiers": ["story"]})
    b["lines"] += 1
    b["chars"] += len(re.sub(r"\s", "", l["tts"]))
S["batches"].update(by)
(VD / "script.json").write_text(json.dumps(S, ensure_ascii=False, indent=1, default=list), encoding="utf-8")
print(f"新增 {len(added)} 句、沿用既有音檔 {len(reused)} 句")
for b, v in by.items():
    print(f"  {b}: {v['lines']} 句 {v['chars']} 字")
for k in reused:
    print("  沿用", k)
