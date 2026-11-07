import type { EndedRun, WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface RunEnded {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly ending: RunEnding | null;
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
    location: RunLocation.of({
      teamId: run.teamId,
      lineId: run.lineId,
      stationId: run.stationId,
      taskId: run.taskId,
    }),
    fingerprint: run.fingerprint,
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
  ) {}

  async ended(event: RunEnded): Promise<void> {
    const { ending } = event;

    if (!ending || !event.taskId || !event.stationId) {
      return;
    }

    const run = await this.work.endedRun(RunId.of(event.runId));

    if (!run) {
      return;
    }

    const end = endOf(run, ending, event.failure, event.asked);
    const { taskId, teamId } = end.location;
    const workspaceId = run.workspaceId;

    const runId = run.runId;

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
