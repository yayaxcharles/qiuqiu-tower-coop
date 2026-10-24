import { describe, expect, it } from 'vitest';
import { smartRun, type SmartStats } from '../src/engine/smartbot';
import { HEROES } from '../src/engine/hero';

/**
 * 地獄（難度 6）關主勝率表。平常跳過；量的時候：
 * `HELL_BOSS_N=100 npx vitest run tests/hell.boss.report.test.ts > out.txt`
 * 每個角色跑 N 局，只印一張小表（不印整局紀錄）。`HELL_BOSS_SEED` 可換種子。
 */
const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const N = Number(env['HELL_BOSS_N'] ?? 0);
const SEED = env['HELL_BOSS_SEED'] ?? 'hellboss';

describe.skipIf(N <= 0)('地獄關主勝率', () => {
  it(`${N} 局 × ${HEROES.length} 角色`, () => {
    const rs: SmartStats[] = [];
    for (const h of HEROES) for (let i = 0; i < N; i++) rs.push(smartRun(`${SEED}-${h}-${i}`, 6, h));
    const rows = ['hell_hourglass_shogun', 'hell_hoarder_toad', 'hell_source'].map((id) => {
      const bs = rs.flatMap((r) => r.bosses.filter((b) => b.id === id));
      const w = bs.filter((b) => b.won).length;
      return { id, n: bs.length, w, bs };
    });
    const src = rows[2]!.bs;
    const forms = [0, 1, 2, 3].map((k) => src.filter((b) => (b.phase ?? 0) >= k).length);
    const lines = ['boss reached won win%'];
    for (const r of rows) lines.push(`${r.id} ${r.n} ${r.w} ${r.n ? (r.w / r.n * 100).toFixed(0) : '-'}% 回合 ${r.n ? (r.bs.reduce((x, b) => x + b.turns, 0) / r.n).toFixed(1) : '-'} 進場血 ${r.n ? (r.bs.reduce((x, b) => x + b.hpIn / b.maxHp, 0) / r.n * 100).toFixed(0) : '-'}%`);
    lines.push(`source form reach f1/f2/f3/f4: ${forms.join('/')}`);
    lines.push(`runs ${rs.length} clear ${rs.filter((r) => r.won).length} (${(rs.filter((r) => r.won).length / rs.length * 100).toFixed(1)}%)`);
    console.log(lines.join('\n'));
    expect(rs.length).toBe(N * HEROES.length);
  }, 3_600_000);
});
