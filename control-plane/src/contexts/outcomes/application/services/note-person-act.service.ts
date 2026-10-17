import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import {
  NextAct,
  personActOf,
} from '@outcomes/domain/value-objects/next-act.vo';
import { Refusal } from '@outcomes/domain/value-objects/refusal.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PersonActed {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly act: string;
  readonly after: string | null;
  readonly at: string;
  readonly tool: string | null;
  readonly server: string | null;
}

export class NotePersonAct {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async acted(event: PersonActed): Promise<void> {
    const act = personActOf(event.act);

    if (!act) {
      return;
    }

    const next = NextAct.of(act, new Date(event.at));
    const refusal =
      act === 'refused' && event.tool
        ? Refusal.of({ tool: event.tool, server: event.server, at: next.at })
        : null;
    const noted = (record: RunRecord): RunRecord => {
      const acted = record.recordAction(next);

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
            next.at,
          );

      if (
        await this.deletions.isDeleted(
          workspaceId,
          taskId,
          teamId ?? existing?.end?.place.teamId,
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
            noted(RunRecord.empty(RunId.of(event.after), workspaceId, taskId)),
          );
        }
        return;
      }

      const acted = noted(existing);

      if (acted !== existing) {
        await this.records.save(acted);
      }
    });
  }
}
