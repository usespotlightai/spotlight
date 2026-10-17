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

  async acted(heard: PersonActed): Promise<void> {
    const act = personActOf(heard.act);

    if (!act) {
      return;
    }

    const next = NextAct.of(act, new Date(heard.at));
    const refusal =
      act === 'refused' && heard.tool
        ? Refusal.of({ tool: heard.tool, server: heard.server, at: next.at })
        : null;
    const noted = (record: RunRecord): RunRecord => {
      const acted = record.recordAction(next);

      return refusal ? acted.refused(refusal) : acted;
    };

    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const taskId = TaskId.of(heard.taskId);
    const run = heard.after ? await this.work.endedRun(heard.after) : null;
    const teamId = run ? TeamId.of(run.teamId) : null;

    await this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId, teamId);
      const existing = heard.after
        ? await this.records.of(RunId.of(heard.after))
        : await this.records.lastEndedOfTaskAt(
            taskId,
            heard.stationId,
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
        if (heard.after) {
          await this.records.add(
            noted(
              RunRecord.heardOf(RunId.of(heard.after), workspaceId, taskId),
            ),
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
