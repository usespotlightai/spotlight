import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

describe('ResumeKey', () => {
  it('names the one workspace a task keeps', () => {
    expect(ResumeKey.forTask(TaskId.of('task_1')).value).toBe('task-task_1');
  });

  it('is the same for every run of the task, and another task’s differs', () => {
    const stored = ResumeKey.forTask(TaskId.of('task_1'));

    expect(ResumeKey.forTask(TaskId.of('task_1')).equals(stored)).toBe(true);
    expect(ResumeKey.forTask(TaskId.of('task_2')).equals(stored)).toBe(false);
  });

  it('names a chat’s directory apart from any task’s', () => {
    expect(ResumeKey.forChat(ChatId.of('chat_1')).value).toBe('chat-chat_1');
    expect(
      ResumeKey.forChat(ChatId.of('1')).equals(
        ResumeKey.forTask(TaskId.of('1')),
      ),
    ).toBe(false);
  });

  it('rejects a key that names nothing', () => {
    expect(() => ResumeKey.of('  ')).toThrow();
  });
  it('names the task or chat whose workspace it keeps', () => {
    expect(ResumeKey.forTask(TaskId.of('task_1')).archiveHolder).toMatchObject({
      kind: 'task',
      taskId: { value: 'task_1' },
    });
    expect(ResumeKey.forChat(ChatId.of('chat-7')).archiveHolder).toMatchObject({
      kind: 'chat',
      chatId: { value: 'chat-7' },
    });
  });

  it('names no holder for a replay or a key of nothing', () => {
    expect(ResumeKey.forReplay(RunId.of('run_1')).archiveHolder).toBeNull();
    expect(ResumeKey.of('task-').archiveHolder).toBeNull();
    expect(ResumeKey.of('workspace').archiveHolder).toBeNull();
  });

  it('is rejoined by later runs and editors only for a task or a chat', () => {
    expect(ResumeKey.forTask(TaskId.of('task_1')).isRejoinable).toBe(true);
    expect(ResumeKey.forChat(ChatId.of('chat_1')).isRejoinable).toBe(true);
    expect(ResumeKey.forReplay(RunId.of('run_1')).isRejoinable).toBe(false);
    expect(ResumeKey.of('task-').isRejoinable).toBe(false);
  });

  it('belongs only to the task, chat, replay or search it names', () => {
    const ofTask1 = RunSubject.task(
      TaskId.of('task_1'),
      null,
      TaskRevision.of(0),
    );

    expect(ResumeKey.forTask(TaskId.of('task_1')).belongsTo(ofTask1)).toBe(
      true,
    );
    expect(ResumeKey.forTask(TaskId.of('task_2')).belongsTo(ofTask1)).toBe(
      false,
    );
    expect(ResumeKey.forTask(TaskId.of('task_1')).belongsTo(null)).toBe(false);
    expect(ResumeKey.forChat(ChatId.of('chat_1')).belongsTo(null)).toBe(false);
    expect(
      ResumeKey.forChat(ChatId.of('chat_1')).belongsTo(
        RunSubject.chat(ChatId.of('chat_2')),
      ),
    ).toBe(false);
    expect(ResumeKey.forReplay(RunId.of('run_1')).belongsTo(null)).toBe(false);
    expect(ResumeKey.forSearch(RunId.of('run_1')).belongsTo(ofTask1)).toBe(
      false,
    );
    expect(ResumeKey.of('scratch').belongsTo(null)).toBe(true);
  });
});
