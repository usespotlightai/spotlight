import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  DispatchedFor,
  DispatchedRun,
  DispatchedRunsPort,
} from '@work/application/ports/dispatched-runs.port';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import { eq } from 'drizzle-orm';

type DispatchRow = Pick<
  typeof dispatch.$inferSelect,
  | 'id'
  | 'kind'
  | 'taskId'
  | 'stationId'
  | 'chatId'
  | 'asOf'
  | 'trialRepositories'
>;

const forOf = (row: DispatchRow): DispatchedFor => {
  if (row.kind === 'chat' && row.chatId) {
    return { kind: 'chat', chatId: ChatId.of(row.chatId) };
  }

  if (row.kind === 'task' && row.taskId && row.stationId) {
    return {
      kind: 'task',
      taskId: TaskId.of(row.taskId),
      stationId: StationId.of(row.stationId),
    };
  }

  if (row.kind === 'trial' && row.stationId) {
    return {
      kind: 'trial',
      stationId: StationId.of(row.stationId),
      asOf: row.asOf,
      repositories: (row.trialRepositories ?? []).map((each) =>
        Repository.of(each.repository),
      ),
    };
  }

  throw new InconsistentStateError(
    'dispatch',
    `has a ${row.kind} subject without its ids (${row.id})`,
  );
};

@Injectable()
export class DrizzleDispatchedRuns implements DispatchedRunsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(runId: RunId): Promise<DispatchedRun | null> {
    const [row] = await this.db
      .select({
        id: dispatch.id,
        kind: dispatch.kind,
        taskId: dispatch.taskId,
        stationId: dispatch.stationId,
        chatId: dispatch.chatId,
        asOf: dispatch.asOf,
        trialRepositories: dispatch.trialRepositories,
        briefedMemories: dispatch.briefedMemories,
      })
      .from(dispatch)
      .where(eq(dispatch.id, runId.value))
      .limit(1);

    return row
      ? {
          runId: RunId.of(row.id),
          for: forOf(row),
          briefedMemories: row.briefedMemories,
        }
      : null;
  }
}
