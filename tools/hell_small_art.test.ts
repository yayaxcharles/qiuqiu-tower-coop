// 2026-10-26 效能：地獄小型魔物的圖原本 460 寬、1920x1080 只顯示約 195 寬，解碼記憶體浪費約 5 倍。
// 打包工具 `tools/pack_hell_art.py` 現在把小型魔物整隻縮到畫布最大寬 320。
// 這條守兩件事：①小型魔物每個姿勢的圖寬不超過 320（有人用舊流程重打包又變回 460 就會紅）；
// ②同一隻各姿勢畫布一樣大（同一個縮放倍率，姿勢之間的相對大小不變）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hellEnemies } from '../src/content/enemies-hell';

/** 讀 WebP 檔頭的寬高（PIL 存帶透明層的有損圖是 VP8X；沒透明層是 VP8 / VP8L） */
function webpSize(path: string): [number, number] {
  const b = readFileSync(path);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (at: number): string => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
  const u24 = (at: number): number => v.getUint8(at) | (v.getUint8(at + 1) << 8) | (v.getUint8(at + 2) << 16);
  expect(tag(0)).toBe('RIFF');
  const fmt = tag(12);
  if (fmt === 'VP8X') return [1 + u24(24), 1 + u24(27)];
  if (fmt === 'VP8 ') return [v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff];
  if (fmt === 'VP8L') { const n = v.getUint32(21, true); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  throw new Error(`認不得的 WebP 格式 ${fmt}：${path}`);
}

describe('地獄小型魔物的圖不浪費解碼記憶體', () => {
  const smalls = hellEnemies.filter((e) => e.size === 'small');
  it('有掃到小型魔物', () => { expect(smalls.length).toBeGreaterThanOrEqual(14); });
  for (const e of smalls) {
    it(`${e.id}：各姿勢圖寬 <= 320、畫布一樣大`, () => {
      const id = e.id;
      const sizes = (['attack', 'hurt', 'block'] as const).map((p) => webpSize(`public/assets/monsters/${id}_${p}.webp`));
      const idle = webpSize(`public/assets/monsters/${id}_idle.webp`);
      for (const [w] of [idle, ...sizes]) expect(w).toBeLessThanOrEqual(320);
      // 出手、挨打、防禦共用同一張畫布（待機自己一張，可以比較窄）
      for (const s of sizes) expect(s).toEqual(sizes[0]);
      expect(idle[1], '待機與其他姿勢同高').toBe(sizes[0]![1]);
      expect(idle[0]).toBeLessThanOrEqual(sizes[0]![0]);
    });
  }
});
