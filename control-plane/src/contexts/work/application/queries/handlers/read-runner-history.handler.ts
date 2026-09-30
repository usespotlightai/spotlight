import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  HistoryOutcome,
  RunnerHistoryAnswer,
} from '@work/application/dto/runner-history.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type {
  RunDigest,
  RunDigestReaderPort,
} from '@work/application/ports/run-digest-reader.port';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import type {
  StationRunReaderPort,
  StationRunRow,
} from '@work/application/ports/station-run-reader.port';
import type { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import { fileChangesOf } from '@work/application/read-models/file-changes-of';
import {
  HISTORY_RUNS,
  historyLength,
  turnedOut,
} from '@work/application/read-models/history-selection';
import { traceOf } from '@work/application/read-models/trace-of';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

const sinceOf = (written: string | null): Date | null => {
  if (!written) {
    return null;
  }

  const at = new Date(written);

  return Number.isNaN(at.getTime()) ? null : at;
};

const withCost = (
  outcome: RunOutcomeShape | null,
  digest: RunDigest | null,
): HistoryOutcome | null =>
  outcome && {
    ...outcome,
    cost: digest && {
      ms: digest.ms,
      steps: digest.steps,
      faults: digest.faults,
      used: digest.used,
      cost: digest.cost?.amount ?? null,
      currency: digest.cost?.currency ?? null,
    },
  };

export class ReadRunnerHistoryHandler
  implements QueryHandlerPort<ReadRunnerHistoryQuery, RunnerHistoryAnswer>
{
  constructor(
    private readonly traces: RunnerTraceReaderPort,
    private readonly stations: StationRunReaderPort,
    private readonly outcomes: RunOutcomesPort,
    private readonly digests: RunDigestReaderPort,
  ) {}

  async execute(query: ReadRunnerHistoryQuery): Promise<RunnerHistoryAnswer> {
    try {
      const team = await this.traces.teamOfHeldRun(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      if (!team) {
        return { kind: 'unknown' };
      }

      const { wanted } = query;
      const keyed = await this.stations.stationsKeyed(
        team,
        wanted.station,
        wanted.line,
      );
      const [only] = keyed;

      if (!only) {
        return { kind: 'unknown' };
      }

      if (keyed.length > 1) {
        return {
          kind: 'ambiguous',
          lines: keyed.map((each) => each.lineKey),
        };
      }

      const last = historyLength(wanted.last);
      const candidates = await this.stations.endedAt(only.stationId, {
        fingerprint: wanted.fingerprint,
        since: sinceOf(wanted.since),
        most: wanted.outcome ? HISTORY_RUNS.searched : last,
      });
      const outcomes = await this.outcomes.of(
        candidates.map((each) => each.runId),
      );
      const kept = candidates
        .filter(
          (each) =>
            !wanted.outcome ||
            turnedOut(outcomes.get(each.runId) ?? null, wanted.outcome),
        )
        .slice(0, last);

      return {
        kind: 'found',
        history: {
          line: { key: only.lineKey, name: only.lineName },
          station: { key: only.stationKey, name: only.stationName },
          configs: (
            await this.stations.configsNamed([
              ...new Set(kept.flatMap((each) => each.fingerprint ?? [])),
            ])
          ).map((each) => ({
            fingerprint: each.fingerprint,
            config: each.parts,
          })),
          runs: await this.written(kept, only.stationName, outcomes),
        },
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async written(
    kept: readonly StationRunRow[],
    station: string,
    outcomes: Awaited<ReturnType<RunOutcomesPort['of']>>,
  ) {
    const journals = new Map(
      (await this.stations.journalsOf(kept.map((each) => each.runId))).map(
        (journal) => [journal.runId, journal],
      ),
    );
    const digests = await this.digests.forRuns(
      kept.map((each) => RunId.of(each.runId)),
    );

    return kept.map((each) => {
      const journal = journals.get(each.runId) ?? null;

      return {
        runId: each.runId,
        taskId: each.taskId,
        title: each.title,
        fingerprint: each.fingerprint,
        state: each.state,
        attempt: each.attempt,
        harness: each.harness,
        startedAt: each.startedAt.toISOString(),
        endedAt: each.endedAt.toISOString(),
        outcome: withCost(
          outcomes.get(each.runId) ?? null,
          digests.get(each.runId) ?? null,
        ),
        changes: journal ? fileChangesOf(journal) : [],
        trace: TaskTraceMapper.toDto(
          traceOf([
            {
              id: RunId.of(each.runId),
              station: StationName.maybe(station),
              harness: HarnessName.of(each.harness),
              state: each.state,
              attempt: each.attempt,
              startedAt: each.startedAt,
              endedAt: each.endedAt,
              journal,
            },
          ]),
        ),
      };
    });
  }
}
