import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { EndedRun, WorkPort } from '@outcomes/application/ports/work.port';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import {
  configFingerprintOf,
  RunEnd,
} from '@outcomes/domain/value-objects/run-end.vo';
import {
  endingOf,
  type RunEnding,
} from '@outcomes/domain/value-objects/run-ending';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
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
  fingerprint: string | null,
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
    fingerprint,
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
    private readonly logger: LoggerPort,
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

    const fingerprint = configFingerprintOf(run.fingerprint);

    if (run.fingerprint !== null && fingerprint === null) {
      this.logger.warn(
        {
          runId: run.runId,
          stationId: run.stationId,
          fingerprint: run.fingerprint,
        },
        'Run ended with a malformed config fingerprint, recorded as no config',
      );
    }

    const end = endOf(run, fingerprint, ending, heard.failure, heard.asked);
    const { taskId, teamId } = end.place;
    const workspaceId = WorkspaceId.of(run.workspaceId);

    await this.transaction.inTransaction(async () => {
      await this.forgotten.lockForgetting(workspaceId, taskId, teamId);
      const runId = RunId.of(run.runId);
      const existing = await this.records.of(runId);

      if (existing?.hasEnded) {
        return;
      }

      if (await this.forgotten.forgot(workspaceId, taskId, teamId)) {
        if (existing) {
          await this.records.removeForTask(taskId);
        }
        return;
      }

      if (existing) {
        await this.records.save(existing.recordEnd(end));
        return;
      }

      await this.records.add(
        RunRecord.heardOf(runId, workspaceId).recordEnd(end),
      );
    });
  }
}
