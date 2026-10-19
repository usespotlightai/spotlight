import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type {
  HistoryCandidateDto,
  HistoryOutcome,
  HistoryRunDto,
  HistoryUsage,
  RunnerHistoryAnswer,
} from '@work/application/dto/runner-history.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';
import type {
  RunUsage,
  RunUsageReaderPort,
} from '@work/application/ports/run-usage-reader.port';
import type {
  LeasedRunFacts,
  RunnerTraceReaderPort,
} from '@work/application/ports/runner-trace-reader.port';
import type { SearchVisibilityPort } from '@work/application/ports/search-visibility.port';
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
import { connectionsOf, traceOf } from '@work/application/read-models/trace-of';
import { VisibleHistory } from '@work/application/read-models/visible-history';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

const sinceOf = (written: string | null): Date | null => {
  if (!written) {
    return null;
  }

  const at = new Date(written);

  return Number.isNaN(at.getTime()) ? null : at;
};

const historyUsageOf = (usage: RunUsage | null): HistoryUsage | null =>
  usage && {
    ms: usage.ms,
    steps: usage.steps,
    errors: usage.errors,
    contextTokens: usage.contextTokens,
    cost: usage.cost?.amount ?? null,
    currency: usage.cost?.currency ?? null,
  };

const withUsage = (
  outcome: RunOutcomeShape | null,
  usage: RunUsage | null,
): HistoryOutcome | null =>
  outcome && { ...outcome, usage: historyUsageOf(usage) };

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
    private readonly usages: RunUsageReaderPort,
    private readonly visibilities: SearchVisibilityPort,
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

      const visible = await this.visibilityFor(query.runId, leased);
      const { wanted } = query;
      const keyed = (
        await this.stations.stationsKeyed(
          leased.teamId,
          wanted.station,
          wanted.line,
        )
      ).filter((each) => visible.seesRunAt(each.stationId));
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
          excluding: visible.heldOutTasks,
        })
      ).filter((each) => !visible.hides(each));
      const outcomes = await this.outcomes.of(
        ended.map((each) => each.runId),
        leased.replaysFrom,
      );
      const filtered = ended
        .filter(
          (each) =>
            !wanted.outcome ||
            turnedOut(outcomes.get(each.runId) ?? null, wanted.outcome),
        )
        .slice(0, last);
      const shown = await this.shownBeyond(only.stationId, visible, filtered);
      const shownOutcomes =
        shown.length > 0
          ? await this.outcomes.of(
              shown.map((each) => each.runId),
              leased.replaysFrom,
            )
          : new Map();
      const listed = [...filtered, ...shown];
      const candidates = await this.candidatesAt(only, visible);

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
          seedBlock: visible.seedBlock,
        },
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async visibilityFor(
    runId: string,
    leased: LeasedRunFacts,
  ): Promise<VisibleHistory> {
    return leased.isSearch
      ? VisibleHistory.limitedTo(await this.visibilities.of(runId))
      : VisibleHistory.unrestricted();
  }

  private async shownBeyond(
    stationId: string,
    visible: VisibleHistory,
    runs: readonly StationRunRow[],
  ): Promise<readonly StationRunRow[]> {
    return (
      await this.stations.endedAmong(stationId, visible.shownBeyond(runs))
    ).filter((each) => !visible.hides(each));
  }

  private async candidatesAt(
    station: KeyedStation,
    visible: VisibleHistory,
  ): Promise<readonly HistoryCandidateDto[]> {
    const visibleRuns = visible.candidates.flatMap((candidate) =>
      candidate.runs.map((run) => [run.runId, run] as const),
    );
    const rows = (
      await this.stations.endedAmong(
        station.stationId,
        visibleRuns.map(([runId]) => runId),
      )
    ).filter((each) => !visible.hides(each));
    const [written, usages] = await Promise.all([
      this.written(rows, station.stationName),
      this.usages.forRuns(rows.map((each) => RunId.of(each.runId))),
    ]);
    const writtenRuns = new Map(written.map((each) => [each.runId, each]));

    return visible.candidates.map((candidate) => ({
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
                usage: historyUsageOf(usages.get(run.runId) ?? null),
                succeeded: run.succeeded,
                reasons: [...run.reasons],
                verdict: run.verdict,
                guidance: run.guidance,
              },
            ]
          : [];
      }),
    }));
  }

  private async withOutcomes(
    runs: readonly StationRunRow[],
    station: string,
    outcomes: Outcomes,
  ): Promise<readonly HistoryRunDto[]> {
    const [written, usages] = await Promise.all([
      this.written(runs, station),
      this.usages.forRuns(runs.map((each) => RunId.of(each.runId))),
    ]);

    return written.map((each) => ({
      ...each,
      outcome: withUsage(
        outcomes.get(each.runId) ?? null,
        usages.get(each.runId) ?? null,
      ),
    }));
  }

  private async written(
    runs: readonly StationRunRow[],
    station: string,
  ): Promise<readonly WrittenRun[]> {
    const runIds = runs.map((each) => each.runId);
    const [found, errors] = await Promise.all([
      this.stations.journalsOf(runIds),
      this.connections.errorsIn(runIds),
    ]);
    const journals = new Map<string, RunJournal>(
      found.map((journal) => [journal.runId, journal]),
    );

    return runs.map((each) => {
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
