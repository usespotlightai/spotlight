import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import {
  NextAct,
  personActOf,
} from '@outcomes/domain/value-objects/next-act.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PersonActed {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly act: string;
  readonly after: string | null;
  readonly at: string;
}

export class NotePersonAct {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  acted(heard: PersonActed): Promise<void> {
    const act = personActOf(heard.act);

    if (!act) {
      return Promise.resolve();
    }

    const next = NextAct.of(act, new Date(heard.at));

    const workspaceId = WorkspaceId.of(heard.workspaceId);
    const taskId = TaskId.of(heard.taskId);

    return this.transaction.run(async () => {
      await this.forgotten.holding(workspaceId, taskId);
      const held = heard.after
        ? await this.records.of(RunId.of(heard.after))
        : await this.records.lastEndedOfTaskAt(
            taskId,
            heard.stationId,
            next.at,
          );

      if (!held) {
        if (
          heard.after &&
          !(await this.forgotten.forgot(workspaceId, taskId))
        ) {
          await this.records.add(
            RunRecord.heardOf(
              RunId.of(heard.after),
              workspaceId,
              taskId,
            ).actedOn(next),
          );
        }
        return;
      }

      const acted = held.actedOn(next);

      if (acted !== held) {
        await this.records.save(acted);
      }
    });
  }
}
