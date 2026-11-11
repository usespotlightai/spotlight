import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  JournalledRun,
  RunChanges,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import {
  RUN_JOURNALS,
  type RunJournalsPort,
} from '@runs/application/ports/run-journals.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type {
  RunsInWorkspace,
  RunsOfChat,
} from '@work/application/ports/viewed-runs';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, asc, eq, isNull, type SQL } from 'drizzle-orm';

type DispatchedRun = Pick<JournalledRun, 'runId' | 'createdAt'>;

@Injectable()
export class DrizzleRunJournalReader implements RunJournalReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(RUN_JOURNALS) private readonly journals: RunJournalsPort,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  async listForTask(
    taskId: TaskId,
  ): Promise<RunsInWorkspace<RunJournal[]> | null> {
    return this.ofTask(taskId, undefined, (runs) =>
      this.journals.ofRuns(runs.map((each) => RunId.of(each.runId))),
    );
  }

  async runsOfTask(
    taskId: TaskId,
  ): Promise<RunsInWorkspace<JournalledRun[]> | null> {
    return this.ofTask(taskId, undefined, (runs) => this.counted(runs));
  }

  async ofTaskRun(
    taskId: TaskId,
    runId: RunId,
  ): Promise<RunsInWorkspace<RunJournal[]> | null> {
    return this.ofTask(taskId, eq(dispatch.id, runId.value), (runs) =>
      this.journals.ofRuns(runs.map((each) => RunId.of(each.runId))),
    );
  }

  async ofRun(runId: RunId): Promise<RunJournal | null> {
    const [journal] = await this.journals.ofRuns([runId]);
    return journal ?? null;
  }

  attemptsOfRun(runId: RunId): Promise<RunJournal[]> {
    return this.journals.ofRuns([runId]);
  }

  async changesOfTask(taskId: TaskId): Promise<RunChanges[]> {
    const runs = await this.dispatched(
      and(eq(dispatch.kind, 'task'), eq(dispatch.taskId, taskId.value)) as SQL,
    );

    return this.journals.changesOf(runs.map((each) => RunId.of(each.runId)));
  }

  async runsOfChat(
    teamId: TeamId,
    chatId: ChatId,
  ): Promise<RunsOfChat<JournalledRun[]> | null> {
    return this.ofChat(teamId, chatId, undefined, (runs) => this.counted(runs));
  }

  async ofChatRun(
    teamId: TeamId,
    chatId: ChatId,
    runId: RunId,
  ): Promise<RunsOfChat<RunJournal[]> | null> {
    return this.ofChat(teamId, chatId, eq(dispatch.id, runId.value), (runs) =>
      this.journals.ofRuns(runs.map((each) => RunId.of(each.runId))),
    );
  }

  private async ofTask<T>(
    taskId: TaskId,
    narrowedTo: SQL | undefined,
    read: (runs: DispatchedRun[]) => Promise<T>,
  ): Promise<RunsInWorkspace<T> | null> {
    const [found] = await this.db
      .select({ workspaceId: task.workspaceId })
      .from(task)
      .where(eq(task.id, taskId.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const runs = await this.dispatched(
      and(
        eq(dispatch.kind, 'task'),
        eq(dispatch.taskId, taskId.value),
        narrowedTo,
      ) as SQL,
    );

    return {
      workspaceId: WorkspaceId.of(found.workspaceId),
      found: await read(runs),
    };
  }

  private async ofChat<T>(
    teamId: TeamId,
    chatId: ChatId,
    narrowedTo: SQL | undefined,
    read: (runs: DispatchedRun[]) => Promise<T>,
  ): Promise<RunsOfChat<T> | null> {
    const [found] = await this.db
      .select({ startedById: chat.startedById })
      .from(chat)
      .where(and(eq(chat.id, chatId.value), eq(chat.teamId, teamId.value)))
      .limit(1);

    if (!found) {
      return null;
    }

    const runs = await this.dispatched(
      and(
        eq(dispatch.kind, 'chat'),
        eq(dispatch.chatId, chatId.value),
        narrowedTo,
      ) as SQL,
    );

    return {
      startedBy: UserId.of(found.startedById),
      teamId,
      found: await read(runs),
    };
  }

  private async counted(runs: DispatchedRun[]): Promise<JournalledRun[]> {
    const startedAt = performance.now();
    const counts = await this.journals.countsOf(
      runs.map((each) => RunId.of(each.runId)),
    );

    this.logger.debug(
      {
        runs: runs.length,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'counted the steps of runs',
    );

    return runs.map((each) => ({
      ...each,
      stepCount: counts.get(each.runId)?.stepCount ?? 0,
      messageCount: counts.get(each.runId)?.messageCount ?? 0,
    }));
  }

  private dispatched(which: SQL): Promise<DispatchedRun[]> {
    return this.db
      .select({ runId: dispatch.id, createdAt: dispatch.orderedAt })
      .from(dispatch)
      .where(and(which, isNull(dispatch.refused)))
      .orderBy(asc(dispatch.orderedAt), asc(dispatch.id));
  }
}
