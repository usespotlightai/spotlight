import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { EndedRun, WorkPort } from '@outcomes/application/ports/work.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import {
  endingOf,
  type RunEnding,
} from '@outcomes/domain/value-objects/run-ending';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunEnded {
  readonly runId: string;
  readonly outcome: string;
  readonly stopped: boolean;
  readonly failure: string | null;
  readonly asked: boolean;
}

const endOf = (
  run: EndedRun,
  ending: RunEnding,
  failure: string | null,
  asked: boolean,
): RunEnd =>
  RunEnd.of({
    place: RunPlace.of({
      teamId: TeamId.of(run.teamId),
      lineId: run.lineId,
      stationId: run.stationId,
      taskId: TaskId.of(run.taskId),
    }),
    fingerprint: run.fingerprint,
    setup: RunSetup.of({
      harness: run.harness,
      model: run.model,
      effort: run.effort,
      profileKey: run.profileKey,
      repositories: run.repositories,
      skills: run.skills,
    }),
    queuedAt: run.queuedAt,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    ending,
    failure,
    round: run.round,
    asked,
  });

export class NoteRunEnded {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  async ended(heard: RunEnded): Promise<void> {
    const ending = endingOf(heard);

    if (!ending) {
      return;
    }

    const run = await this.work.endedRun(heard.runId);

    if (!run) {
      return;
    }

    const end = endOf(run, ending, heard.failure, heard.asked);
    const { taskId, teamId } = end.place;
    const workspaceId = WorkspaceId.of(run.workspaceId);

    await this.transaction.run(async () => {
      await this.forgotten.holding(workspaceId, taskId, teamId);
      const runId = RunId.of(run.runId);
      const held = await this.records.of(runId);

      if (held?.hasEnded) {
        return;
      }

      if (await this.forgotten.forgot(workspaceId, taskId, teamId)) {
        if (held) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (held) {
        await this.records.save(held.ended(end));
        return;
      }

      await this.records.add(RunRecord.heardOf(runId, workspaceId).ended(end));
    });
  }
}
