import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

const TASK = 'task-';

const CHAT = 'chat-';

export class ResumeKey {
  private constructor(readonly value: string) {}

  static of(raw: string): ResumeKey {
    const key = raw.trim();

    if (key.length === 0) {
      throw new InvalidIdentifierError('resume key');
    }

    return new ResumeKey(key);
  }

  static forTask(taskId: string): ResumeKey {
    return ResumeKey.of(`${TASK}${taskId}`);
  }

  static forChat(chatId: string): ResumeKey {
    return ResumeKey.of(`${CHAT}${chatId}`);
  }

  static forReplay(runId: string): ResumeKey {
    return ResumeKey.of(`replay-${runId}`);
  }

  get archiveHolder(): ArchiveHolder | null {
    const of = (prefix: string): string | null =>
      this.value.startsWith(prefix) && this.value.length > prefix.length
        ? this.value.slice(prefix.length)
        : null;
    const task = of(TASK);
    const chat = of(CHAT);

    if (task) {
      return { kind: 'task', taskId: TaskId.of(task) };
    }

    return chat ? { kind: 'chat', chatId: ChatId.of(chat) } : null;
  }

  equals(other: ResumeKey): boolean {
    return this.value === other.value;
  }
}
