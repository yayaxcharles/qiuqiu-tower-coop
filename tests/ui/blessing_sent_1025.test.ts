import { describe, expect, it } from 'vitest';
import RAW from '../../src/ui/screens/blessing.ts?raw';

/*
 * 連線房主是當場套用：`submitRun` 裡 `onRunApplied` 就跑完、把 `sent` 清掉並重畫。
 * `sent = true` 若寫在送出之後，會把它蓋回 true，地獄開局那三張攻擊牌永遠不出現（2026-10-25 連線實測，房主卡在「等同伴」）。
 * 守法：每一次 `coop.submitRun(` 之前最近的一個 `sent` 指派必須是 `sent = true`，送出之後不准再設 true。
 */
const SRC = RAW.replace(/\r\n/g, '\n');

describe('祝福畫面：送出之前就標 sent（房主當場套用不被蓋回）', () => {
  const calls = [...SRC.matchAll(/coop\.submitRun\(/g)].map((m) => m.index!);
  it('有兩處送出（祝福、開局攻擊牌）', () => expect(calls.length).toBe(2));
  it.each(calls.map((at, n) => [n, at] as const))('第 %i 處：送出前設 true、送出後只在失敗時設回 false', (_n, at) => {
    const before = SRC.slice(0, at);
    const lastAssign = [...before.matchAll(/\bsent = (true|false)/g)].pop();
    expect(lastAssign?.[1]).toBe('true');
    const fnEnd = SRC.indexOf('\n  }\n', at);
    const after = SRC.slice(at, fnEnd);
    expect(after).not.toMatch(/\bsent = true/);
    expect(after).toMatch(/if \(sent\) render\(\);/);
  });
});
