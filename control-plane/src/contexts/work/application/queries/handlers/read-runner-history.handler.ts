import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type {
  HistoryCandidateDto,
  HistoryCost,
  HistoryOutcome,
  HistoryRunDto,
  RunnerHistoryAnswer,
} from '@work/application/dto/runner-history.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';
import type {
  RunDigest,
  RunDigestReaderPort,
} from '@work/application/ports/run-digest-reader.port';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';
import type {
  LeasedRunFacts,
  RunnerTraceReaderPort,
} from '@work/application/ports/runner-trace-reader.port';
import type { SearchSightPort } from '@work/application/ports/search-sight.port';
import type {
  KeyedStation,
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
import { SightedHistory } from '@work/application/read-models/sighted-history';
import { connectionsOf, traceOf } from '@work/application/read-models/trace-of';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

const sinceOf = (written: string | null): Date | null => {
  if (!written) {
    return null;
  }

  const at = new Date(written);

  return Number.isNaN(at.getTime()) ? null : at;
};

const costOf = (digest: RunDigest | null): HistoryCost | null =>
  digest && {
    ms: digest.ms,
    steps: digest.steps,
    faults: digest.faults,
    used: digest.used,
    cost: digest.cost?.amount ?? null,
    currency: digest.cost?.currency ?? null,
  };

const withCost = (
  outcome: RunOutcomeShape | null,
  digest: RunDigest | null,
): HistoryOutcome | null => outcome && { ...outcome, cost: costOf(digest) };

type Outcomes = Awaited<ReturnType<RunOutcomesPort['of']>>;

interface WrittenRun {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly fingerprint: string | null;
  readonly state: string;
  readonly attempt: number;
  readonly harness: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly changes: HistoryRunDto['changes'];
  readonly trace: HistoryRunDto['trace'];
}

export class ReadRunnerHistoryHandler
  implements QueryHandlerPort<ReadRunnerHistoryQuery, RunnerHistoryAnswer>
{
  constructor(
    private readonly traces: RunnerTraceReaderPort,
    private readonly stations: StationRunReaderPort,
    private readonly outcomes: RunOutcomesPort,
    private readonly digests: RunDigestReaderPort,
    private readonly sights: SearchSightPort,
    private readonly connections: RunConnectionsPort,
  ) {}

  async execute(query: ReadRunnerHistoryQuery): Promise<RunnerHistoryAnswer> {
    try {
      const leased = await this.traces.leasedRunFacts(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      if (!leased) {
        return { kind: 'unknown' };
      }

      const sighted = await this.sightedBy(query.runId, leased);
      const { wanted } = query;
      const keyed = (
        await this.stations.stationsKeyed(
          leased.teamId,
          wanted.station,
          wanted.line,
        )
      ).filter((each) => sighted.seesRunAt(each.stationId));
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
      const ended = (
        await this.stations.endedAt(only.stationId, {
          fingerprint: wanted.fingerprint,
          since: sinceOf(wanted.since),
          until: leased.replaysFrom,
          max: wanted.outcome ? HISTORY_RUNS.matched : last,
          excluding: sighted.hiddenTasks,
        })
      ).filter((each) => !sighted.hides(each));
      const outcomes = await this.outcomes.of(
        ended.map((each) => each.runId),
        leased.replaysFrom,
      );
      const kept = ended
        .filter(
          (each) =>
            !wanted.outcome ||
            turnedOut(outcomes.get(each.runId) ?? null, wanted.outcome),
        )
        .slice(0, last);
      const shown = await this.shownBeyond(only.stationId, sighted, kept);
      const shownOutcomes =
        shown.length > 0
          ? await this.outcomes.of(
              shown.map((each) => each.runId),
              leased.replaysFrom,
            )
          : new Map();
      const listed = [...kept, ...shown];
      const candidates = await this.candidatesAt(only, sighted);

      return {
        kind: 'found',
        history: {
          line: { key: only.lineKey, name: only.lineName },
          station: { key: only.stationKey, name: only.stationName },
          configs: (
            await this.stations.configsNamed([
              ...new Set(
                [...listed, ...candidates].flatMap(
                  (each) => each.fingerprint ?? [],
                ),
              ),
            ])
          ).map((each) => ({
            fingerprint: each.fingerprint,
            config: each.parts,
          })),
          runs: await this.withOutcomes(
            listed,
            only.stationName,
            new Map([...outcomes, ...shownOutcomes]),
          ),
          candidates,
          seedBlock: sighted.seedBlock,
        },
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async sightedBy(
    runId: string,
    leased: LeasedRunFacts,
  ): Promise<SightedHistory> {
    return leased.isSearch
      ? SightedHistory.through(await this.sights.of(runId))
      : SightedHistory.unsighted();
  }

  private async shownBeyond(
    stationId: string,
    sighted: SightedHistory,
    kept: readonly StationRunRow[],
  ): Promise<readonly StationRunRow[]> {
    return (
      await this.stations.endedAmong(stationId, sighted.shownBeyond(kept))
    ).filter((each) => !sighted.hides(each));
  }

  private async candidatesAt(
    station: KeyedStation,
    sighted: SightedHistory,
  ): Promise<readonly HistoryCandidateDto[]> {
    const sightedRuns = sighted.candidates.flatMap((candidate) =>
      candidate.runs.map((run) => [run.runId, run] as const),
    );
    const rows = (
      await this.stations.endedAmong(
        station.stationId,
        sightedRuns.map(([runId]) => runId),
      )
    ).filter((each) => !sighted.hides(each));
    const [written, digests] = await Promise.all([
      this.written(rows, station.stationName),
      this.digests.forRuns(rows.map((each) => RunId.of(each.runId))),
    ]);
    const writtenRuns = new Map(written.map((each) => [each.runId, each]));

    return sighted.candidates.map((candidate) => ({
      candidateName: candidate.name,
      fingerprint: candidate.fingerprint,
      hypothesis: candidate.hypothesis,
      block: candidate.block,
      runs: candidate.runs.flatMap((run) => {
        const ran = writtenRuns.get(run.runId);

        return ran
          ? [
              {
                ...ran,
                original: run.original,
                repeat: run.repeat,
                cost: costOf(digests.get(run.runId) ?? null),
                succeeded: run.succeeded,
                reasons: [...run.reasons],
                verdict: run.verdict,
              },
            ]
          : [];
      }),
    }));
  }

  private async withOutcomes(
    kept: readonly StationRunRow[],
    station: string,
    outcomes: Outcomes,
  ): Promise<readonly HistoryRunDto[]> {
    const [written, digests] = await Promise.all([
      this.written(kept, station),
      this.digests.forRuns(kept.map((each) => RunId.of(each.runId))),
    ]);

    return written.map((each) => ({
      ...each,
      outcome: withCost(
        outcomes.get(each.runId) ?? null,
        digests.get(each.runId) ?? null,
      ),
    }));
  }

  private async written(
    kept: readonly StationRunRow[],
    station: string,
  ): Promise<readonly WrittenRun[]> {
    const runIds = kept.map((each) => each.runId);
    const [told, errors] = await Promise.all([
      this.stations.journalsOf(runIds),
      this.connections.errorsIn(runIds),
    ]);
    const journals = new Map<string, RunJournal>(
      told.map((journal) => [journal.runId, journal]),
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
              connections: connectionsOf(errors, each.runId, each.attempt),
            },
          ]),
        ),
      };
    });
  }
}
