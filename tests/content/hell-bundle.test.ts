import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/*
 * 地獄（難度 6）的魔物與遭遇（`content/enemies-hell.ts`）是按需載入的另一包，首次載入的進入點不能靜態引用它
 * （一靜態引用，47 隻魔物又回到首包；首載預算見 tools/check_size.py）。
 */

const SRC = resolve(__dirname, '../../src');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 靜態 import／export-from 的相對路徑（動態 `import(...)` 不算，那正是另包的做法） */
function staticDeps(file: string): string[] {
  const text = strip(readFileSync(file, 'utf8'));
  const out: string[] = [];
  for (const m of text.matchAll(/(?:^|[;\n])\s*(?:import|export)\s+(?:type\s+)?(?:[^'"()]*?\sfrom\s+)?['"](\.[^'"]+)['"]/g)) {
    const base = resolve(dirname(file), m[1]!);
    const hit = [`${base}.ts`, `${base}/index.ts`, base].find((p) => existsSync(p) && /\.ts$/.test(p));
    if (hit) out.push(hit);
  }
  return out;
}

describe('地獄資料另包', () => {
  it('首次載入的進入點（main.ts）沿靜態引用走，碰不到 enemies-hell', () => {
    const seen = new Set<string>();
    const stack = [resolve(SRC, 'main.ts')];
    while (stack.length) {
      const f = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      stack.push(...staticDeps(f));
    }
    expect(seen.size, '走訪沒走到東西，解析壞了').toBeGreaterThan(50);
    expect([...seen].filter((f) => /enemies-hell/.test(f))).toEqual([]);
    // 另包的入口：enemies.ts 用動態載入
    expect(readFileSync(resolve(SRC, 'content/enemies.ts'), 'utf8')).toMatch(/import\('\.\/enemies-hell'\)/);
  });

  it('載之前抽地獄遭遇會丟錯（不會安靜拿到空池）；載好之後註冊冪等，載兩次不重複', async () => {
    vi.resetModules();
    const m = await import('../../src/content/enemies');
    expect(m.isHellLoaded()).toBe(false);
    expect(() => m.encountersOfPool('弱', 1, true)).toThrow();
    expect(m.encountersOfPool('弱', 1, false).length, '一般難度不受影響').toBeGreaterThan(0);
    const n0 = m.enemies.length, e0 = m.encounters.length;
    await Promise.all([m.ensureHell(), m.ensureHell()]);
    await m.ensureHell();
    expect(m.isHellLoaded()).toBe(true);
    const hell = await import('../../src/content/enemies-hell');
    expect(m.enemies.length).toBe(n0 + hell.hellEnemies.length);
    expect(m.encounters.length).toBe(e0 + hell.hellEncounters.length);
    m.registerHell(hell.hellEnemies, hell.hellEncounters);   // 再註冊一次也不重複
    expect(m.enemies.length).toBe(n0 + hell.hellEnemies.length);
    expect(m.enemyById['hell_source']).toBeTruthy();
    expect(m.encountersOfPool('弱', 1, true).length).toBeGreaterThan(0);
    expect(m.encountersOfPool('弱', 1, false).every((e) => !e.hell)).toBe(true);
  });
});
