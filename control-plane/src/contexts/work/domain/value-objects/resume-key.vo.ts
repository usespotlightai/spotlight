import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export type ResumeKeyKind = 'task' | 'chat' | 'replay' | 'search' | 'named';

const PREFIXES = {
  task: 'task-',
  chat: 'chat-',
  replay: 'replay-',
  search: 'search-',
} as const satisfies Record<Exclude<ResumeKeyKind, 'named'>, string>;

const kindOf = (key: string): ResumeKeyKind => {
  const tagged = (Object.keys(PREFIXES) as (keyof typeof PREFIXES)[]).find(
    (kind) =>
      key.startsWith(PREFIXES[kind]) && key.length > PREFIXES[kind].length,
  );

  return tagged ?? 'named';
};

export class ResumeKey {
  private constructor(
    readonly kind: ResumeKeyKind,
    readonly value: string,
  ) {}

  static of(raw: string): ResumeKey {
    const key = raw.trim();

    if (key.length === 0) {
      throw new InvalidIdentifierError('resume key');
    }

    return new ResumeKey(kindOf(key), key);
  }

  static forTask(taskId: TaskId): ResumeKey {
    return ResumeKey.of(`${PREFIXES.task}${taskId.value}`);
  }

  static forChat(chatId: ChatId): ResumeKey {
    return ResumeKey.of(`${PREFIXES.chat}${chatId.value}`);
  }

  static forReplay(runId: RunId): ResumeKey {
    return ResumeKey.of(`${PREFIXES.replay}${runId.value}`);
  }

  static forSearch(runId: RunId): ResumeKey {
    return ResumeKey.of(`${PREFIXES.search}${runId.value}`);
  }

  private get tail(): string {
    return this.kind === 'named'
      ? this.value
      : this.value.slice(PREFIXES[this.kind].length);
  }

  get archiveHolder(): ArchiveHolder | null {
    switch (this.kind) {
      case 'task':
        return { kind: 'task', taskId: TaskId.of(this.tail) };
      case 'chat':
        return { kind: 'chat', chatId: ChatId.of(this.tail) };
      default:
        return null;
    }
  }

  get isRejoinable(): boolean {
    return this.kind === 'task' || this.kind === 'chat';
  }

  belongsTo(subject: RunSubject | null): boolean {
    switch (this.kind) {
      case 'task':
        return subject?.taskId?.value === this.tail;
      case 'chat':
        return subject?.chatId?.value === this.tail;
      case 'replay':
        return subject?.isReplay ?? false;
      case 'search':
        return subject?.isSearch ?? false;
      case 'named':
        return true;
    }
  }

  equals(other: ResumeKey): boolean {
    return this.value === other.value;
  }
}
