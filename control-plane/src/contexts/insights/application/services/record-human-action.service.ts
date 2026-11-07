import type { WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import {
  HumanAction,
  humanActionKindOf,
} from '@insights/domain/value-objects/human-action.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface HumanActionReceived {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly action: string;
  readonly afterRunId: string | null;
  readonly at: string;
  readonly tool: string | null;
  readonly server: string | null;
}

export class RecordHumanAction {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  async acted(event: HumanActionReceived): Promise<void> {
    const kind = humanActionKindOf(event.action);

    if (!kind) {
      return;
    }

    const action = HumanAction.of(kind, new Date(event.at));
    const tool = { tool: event.tool, server: event.server };
    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = TaskId.of(event.taskId);
    const run = event.afterRunId
      ? await this.work.endedRun(event.afterRunId)
      : null;
    const owner = FactOwner.of(workspaceId, {
      teamId: run ? TeamId.of(run.teamId) : null,
      taskId,
    });
    const afterRunId = event.afterRunId ? RunId.of(event.afterRunId) : null;

    await this.transaction.inTransaction(() =>
      this.recorder.record(this.records, {
        owner,
        erased: (existing) => existing.erased(),
        load: () =>
          afterRunId
            ? this.records.of(afterRunId)
            : this.records.lastEndedOfTaskAt(
                taskId,
                StationId.of(event.stationId),
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
