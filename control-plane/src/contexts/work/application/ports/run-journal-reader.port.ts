import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  JournalledRun,
  RunChanges,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import type {
  RunsInWorkspace,
  RunsOfChat,
} from '@work/application/ports/viewed-runs';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export const RUN_JOURNAL_READER = Symbol('RUN_JOURNAL_READER');

export interface RunJournalReaderPort {
  listForTask(taskId: TaskId): Promise<RunsInWorkspace<RunJournal[]> | null>;

  runsOfTask(taskId: TaskId): Promise<RunsInWorkspace<JournalledRun[]> | null>;

  ofTaskRun(
    taskId: TaskId,
    runId: RunId,
  ): Promise<RunsInWorkspace<RunJournal[]> | null>;

  ofRun(runId: RunId): Promise<RunJournal | null>;

  attemptsOfRun(runId: RunId): Promise<RunJournal[]>;

  changesOfTask(taskId: TaskId): Promise<RunChanges[]>;

  runsOfChat(
    teamId: TeamId,
    chatId: ChatId,
  ): Promise<RunsOfChat<JournalledRun[]> | null>;

  ofChatRun(
    teamId: TeamId,
    chatId: ChatId,
    runId: RunId,
  ): Promise<RunsOfChat<RunJournal[]> | null>;
}
