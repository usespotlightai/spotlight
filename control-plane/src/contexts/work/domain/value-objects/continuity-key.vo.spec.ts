import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { describe, expect, it } from 'vitest';

describe('ContinuityKey', () => {
  it('names the one workspace a task keeps', () => {
    expect(ContinuityKey.forTask('task_1').value).toBe('task-task_1');
  });

  it('is the same for every run of the task, and another task’s differs', () => {
    const kept = ContinuityKey.forTask('task_1');

    expect(ContinuityKey.forTask('task_1').equals(kept)).toBe(true);
    expect(ContinuityKey.forTask('task_2').equals(kept)).toBe(false);
  });

  it('names a chat’s directory apart from any task’s', () => {
    expect(ContinuityKey.forChat('chat_1').value).toBe('chat-chat_1');
    expect(ContinuityKey.forChat('1').equals(ContinuityKey.forTask('1'))).toBe(
      false,
    );
  });

  it('refuses a key that names nothing', () => {
    expect(() => ContinuityKey.of('  ')).toThrow();
  });
});
