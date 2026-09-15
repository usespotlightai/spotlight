import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export const RUN_JOURNAL_READER = Symbol('RUN_JOURNAL_READER');

export interface RunJournalReaderPort {
  listForTask(taskId: TaskId, viewerId: UserId): Promise<RunJournal[] | null>;

  listForChat(
    teamId: TeamId,
    chatId: ChatId,
    viewerId: UserId,
  ): Promise<RunJournal[] | null>;
}
