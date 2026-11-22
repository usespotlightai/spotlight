import type { WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import {
  PersonAction,
  actionKindOf,
} from '@insights/domain/value-objects/person-action.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ActionReceived {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly action: string;
  readonly by: string;
  readonly afterRunId: string | null;
  readonly at: string;
  readonly tool: string | null;
  readonly server: string | null;
}

export class RecordRunAction {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  async acted(event: ActionReceived): Promise<void> {
    const kind = actionKindOf(event.action);

    if (!kind) {
      return;
    }

    const action = PersonAction.of(
      kind,
      new Date(event.at),
      UserId.of(event.by),
    );
    const tool = { tool: event.tool, server: event.server };
    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = TaskId.of(event.taskId);
    const run = event.afterRunId
      ? await this.work.endedRun(RunId.of(event.afterRunId))
      : null;
    const owner = FactOwner.of(workspaceId, {
      teamId: run?.teamId ?? null,
      taskId,
    });
    const afterRunId = event.afterRunId ? RunId.of(event.afterRunId) : null;

    await this.transaction.inTransaction(() =>
      this.recorder.record(this.records, {
        owner,
        deleted: (existing) => existing.delete(),
        load: async () =>
          afterRunId
            ? this.records.of(afterRunId)
            : RunRecord.creditedWithActionAt(
                await this.records.ofTaskAt(
                  taskId,
                  StationId.of(event.stationId),
                ),
                action.at,
              ),
        ownerOf: (existing) => owner.withTeam(existing.end?.location.teamId),
        fresh: afterRunId
          ? () => RunRecord.empty(afterRunId, workspaceId, taskId)
          : undefined,
        change: (record) => record.recordAction(action, tool),
      }),
    );
  }
}
