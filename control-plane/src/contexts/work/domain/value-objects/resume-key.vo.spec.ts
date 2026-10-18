import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { describe, expect, it } from 'vitest';

describe('ResumeKey', () => {
  it('names the one workspace a task keeps', () => {
    expect(ResumeKey.forTask('task_1').value).toBe('task-task_1');
  });

  it('is the same for every run of the task, and another task’s differs', () => {
    const stored = ResumeKey.forTask('task_1');

    expect(ResumeKey.forTask('task_1').equals(stored)).toBe(true);
    expect(ResumeKey.forTask('task_2').equals(stored)).toBe(false);
  });

  it('names a chat’s directory apart from any task’s', () => {
    expect(ResumeKey.forChat('chat_1').value).toBe('chat-chat_1');
    expect(ResumeKey.forChat('1').equals(ResumeKey.forTask('1'))).toBe(false);
  });

  it('rejects a key that names nothing', () => {
    expect(() => ResumeKey.of('  ')).toThrow();
  });
});
