import { describe, expect, it } from 'vitest';
import { _resetHellQuipsForTest, firstMeetLine, loadHellQuips } from '../../src/content/dialogue';
import { HELL_FIRST_MEET } from '../../src/content/hell-quips';

/*
 * 地獄的初見吐槽另包、動態載入：載好之前回空字串（畫面端的 toast 看到空字串就略過），載好之後回真句子。
 * 這支檔案的順序有意義：同一支檔案裡模組狀態共用，所以「載入前」那條要排在「載入後」前面。
 */
describe('地獄初見吐槽的延後載入', () => {
  it('載入前：地獄魔物回空字串，一般魔物不受影響', () => {
    _resetHellQuipsForTest();
    expect(firstMeetLine('ninja', 'hell_fuse_imp')).toBe('');
    expect(firstMeetLine('fengfeng', 'hell_source')).toBe('');
    expect(firstMeetLine('ninja', 'wild_boar')).toBe('牠一直在刨地，看來要衝過來了喵。');
  });

  it('載入後：四位角色各拿到自己那一句；重複載入不出事', async () => {
    await loadHellQuips();
    await loadHellQuips();
    for (const h of ['ninja', 'feifei', 'dangdang', 'fengfeng']) {
      expect(firstMeetLine(h, 'hell_fuse_imp'), h).toBe(HELL_FIRST_MEET[h]!['hell_fuse_imp']);
      expect(firstMeetLine(h, 'hell_fuse_imp'), h).not.toBe('');
    }
    expect(firstMeetLine(undefined, 'hell_source')).toBe(HELL_FIRST_MEET['ninja']!['hell_source']);
    // 一般魔物的結果與載入前一模一樣
    expect(firstMeetLine('ninja', 'wild_boar')).toBe('牠一直在刨地，看來要衝過來了喵。');
  });
});
