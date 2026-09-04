import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export const RUN_JOURNAL_READER = Symbol('RUN_JOURNAL_READER');

export interface RunJournalReaderPort {
  /** Every run that worked this task, oldest first. Null if it is not theirs. */
  listForTask(taskId: TaskId, viewerId: UserId): Promise<RunJournal[] | null>;
}
