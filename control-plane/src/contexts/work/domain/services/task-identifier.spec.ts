import { taskIdentifier } from '@work/domain/services/task-identifier';
import { describe, expect, it } from 'vitest';

describe('taskIdentifier', () => {
  it('joins the upper-case team key and the number with a dash', () => {
    expect(taskIdentifier('spo', 272)).toBe('SPO-272');
  });

  it('keeps the dashes of a team key', () => {
    expect(taskIdentifier('core-platform', 1)).toBe('CORE-PLATFORM-1');
  });
});
