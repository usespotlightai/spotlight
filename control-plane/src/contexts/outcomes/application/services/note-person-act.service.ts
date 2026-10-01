import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
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
    private readonly forgotten: ForgottenPort,
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
      const acted = record.actedOn(next);

      return refusal ? acted.refused(refusal) : acted;
    };

    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const taskId = TaskId.of(heard.taskId);
    const run = heard.after ? await this.work.endedRun(heard.after) : null;
    const teamId = run ? TeamId.of(run.teamId) : null;

    await this.transaction.run(async () => {
      await this.forgotten.holding(workspaceId, taskId, teamId);
      const held = heard.after
        ? await this.records.of(RunId.of(heard.after))
        : await this.records.lastEndedOfTaskAt(
            taskId,
            heard.stationId,
            next.at,
          );

      if (
        await this.forgotten.forgot(
          workspaceId,
          taskId,
          teamId ?? held?.end?.place.teamId,
        )
      ) {
        if (held) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (!held) {
        if (heard.after) {
          await this.records.add(
            noted(
              RunRecord.heardOf(RunId.of(heard.after), workspaceId, taskId),
            ),
          );
        }
        return;
      }

      const acted = noted(held);

      if (acted !== held) {
        await this.records.save(acted);
      }
    });
  }
}
