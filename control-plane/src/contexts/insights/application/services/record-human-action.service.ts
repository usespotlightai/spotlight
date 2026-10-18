import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import {
  HumanAction,
  humanActionKindOf,
} from '@insights/domain/value-objects/human-action.vo';
import { Refusal } from '@insights/domain/value-objects/refusal.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface HumanActionReceived {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly action: string;
  readonly after: string | null;
  readonly at: string;
  readonly tool: string | null;
  readonly server: string | null;
}

export class RecordHumanAction {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async acted(event: HumanActionReceived): Promise<void> {
    const kind = humanActionKindOf(event.action);

    if (!kind) {
      return;
    }

    const action = HumanAction.of(kind, new Date(event.at));
    const refusal =
      kind === 'refused' && event.tool
        ? Refusal.of({ tool: event.tool, server: event.server, at: action.at })
        : null;
    const withAction = (record: RunRecord): RunRecord => {
      const acted = record.recordAction(action);

      return refusal ? acted.refused(refusal) : acted;
    };

    const workspaceId = WorkspaceId.of(event.workspaceId);
    const taskId = TaskId.of(event.taskId);
    const run = event.after ? await this.work.endedRun(event.after) : null;
    const teamId = run ? TeamId.of(run.teamId) : null;

    await this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId, teamId);
      const existing = event.after
        ? await this.records.of(RunId.of(event.after))
        : await this.records.lastEndedOfTaskAt(
            taskId,
            event.stationId,
            action.at,
          );

      if (
        await this.deletions.isDeleted(
          workspaceId,
          taskId,
          teamId ?? existing?.end?.location.teamId,
        )
      ) {
        if (existing) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (!existing) {
        if (event.after) {
          await this.records.add(
            withAction(
              RunRecord.empty(RunId.of(event.after), workspaceId, taskId),
            ),
          );
        }
        return;
      }

      const acted = withAction(existing);

      if (acted !== existing) {
        await this.records.save(acted);
      }
    });
  }
}
