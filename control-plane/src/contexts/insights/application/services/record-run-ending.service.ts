import type { EndedRun, WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import {
  endingOf,
  type RunEnding,
} from '@insights/domain/value-objects/run-ending';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunEnded {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
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
    location: RunLocation.of({
      teamId: TeamId.of(run.teamId),
      lineId: LineId.of(run.lineId),
      stationId: StationId.of(run.stationId),
      taskId: TaskId.of(run.taskId),
    }),
    fingerprint,
    agentConfig: RunAgentConfig.of({
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
    visit: run.visit,
    asked,
  });

export class RecordRunEnding {
  constructor(
    private readonly work: WorkPort,
    private readonly records: RunRecordRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async ended(event: RunEnded): Promise<void> {
    const ending = endingOf(event);

    if (!ending || !event.taskId || !event.stationId) {
      return;
    }

    const run = await this.work.endedRun(event.runId);

    if (!run) {
      return;
    }

    const fingerprint = ConfigFingerprint.readable(run.fingerprint);

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

    const end = endOf(run, fingerprint, ending, event.failure, event.asked);
    const { taskId, teamId } = end.location;
    const workspaceId = WorkspaceId.of(run.workspaceId);

    const runId = RunId.of(run.runId);

    await this.transaction.inTransaction(() =>
      this.recorder.record(this.records, {
        owner: FactOwner.of(workspaceId, { teamId, taskId }),
        erased: (existing) => existing.erased(),
        load: () => this.records.of(runId),
        fresh: () => RunRecord.empty(runId, workspaceId),
        change: (record) => record.recordEnd(end),
      }),
    );
  }
}
