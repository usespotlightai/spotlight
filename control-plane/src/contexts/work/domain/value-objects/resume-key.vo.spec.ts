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
  it('names the task or chat whose workspace it keeps', () => {
    expect(ResumeKey.forTask('task_1').archiveHolder).toMatchObject({
      kind: 'task',
      taskId: { value: 'task_1' },
    });
    expect(ResumeKey.forChat('chat-7').archiveHolder).toMatchObject({
      kind: 'chat',
      chatId: { value: 'chat-7' },
    });
  });

  it('names no holder for a replay or a key of nothing', () => {
    expect(ResumeKey.forReplay('run_1').archiveHolder).toBeNull();
    expect(ResumeKey.of('task-').archiveHolder).toBeNull();
    expect(ResumeKey.of('workspace').archiveHolder).toBeNull();
  });
});
