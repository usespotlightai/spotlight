import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

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
    return ResumeKey.of(`task-${taskId}`);
  }

  static forChat(chatId: string): ResumeKey {
    return ResumeKey.of(`chat-${chatId}`);
  }

  static forReplay(runId: string): ResumeKey {
    return ResumeKey.of(`replay-${runId}`);
  }

  equals(other: ResumeKey): boolean {
    return this.value === other.value;
  }
}
