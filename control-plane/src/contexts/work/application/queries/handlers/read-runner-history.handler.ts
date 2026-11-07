import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  HistoryOutcome,
  HistoryRunDto,
  RunnerHistoryAnswer,
} from '@work/application/dto/runner-history.dto';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';
import type {
  RunUsage,
  RunUsageReaderPort,
} from '@work/application/ports/run-usage-reader.port';
import type {
  StationRunReaderPort,
  StationRunRow,
} from '@work/application/ports/station-run-reader.port';
import type { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import {
  HISTORY_RUNS,
  historyLength,
  turnedOut,
} from '@work/application/read-models/history-selection';
import type { HistoryAccesses } from '@work/application/services/history-accesses.service';
import {
  historyUsageOf,
  type StationRunHistories,
} from '@work/application/services/station-run-histories.service';
import type { HistoryAccess } from '@work/domain/services/history-access';

const sinceOf = (written: string | null): Date | null => {
  if (!written) {
    return null;
  }

  const at = new Date(written);

  return Number.isNaN(at.getTime()) ? null : at;
};

const withUsage = (
  outcome: RunOutcomeShape | null,
  usage: RunUsage | null,
): HistoryOutcome | null =>
  outcome && { ...outcome, usage: historyUsageOf(usage) };

type Outcomes = Awaited<ReturnType<RunOutcomesPort['of']>>;

export class ReadRunnerHistoryHandler
  implements QueryHandlerPort<ReadRunnerHistoryQuery, RunnerHistoryAnswer>
{
  constructor(
    private readonly accesses: HistoryAccesses,
    private readonly stations: StationRunReaderPort,
    private readonly outcomes: RunOutcomesPort,
    private readonly usages: RunUsageReaderPort,
    private readonly histories: StationRunHistories,
  ) {}

  async execute(query: ReadRunnerHistoryQuery): Promise<RunnerHistoryAnswer> {
    try {
      const leased = await this.accesses.leasedBy(query.runId, query.runnerId);

      if (!leased) {
        return { kind: 'unknown' };
      }

      const { access } = leased;
      const { wanted } = query;
      const keyed = (
        await this.stations.stationsKeyed(
          leased.team,
          wanted.station,
          wanted.line,
        )
      ).filter((each) => access.seesRunAt(each.stationId));
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
          until: access.asOf,
          max: wanted.outcome ? HISTORY_RUNS.matched : last,
          excluding: access.hiddenTaskIds,
        })
      ).filter((each) => !access.hides(each));
      const outcomes = await this.outcomes.of(
        ended.map((each) => each.runId),
        access.asOf,
      );
      const filtered = ended
        .filter(
          (each) =>
            !wanted.outcome ||
            turnedOut(outcomes.get(each.runId) ?? null, wanted.outcome),
        )
        .slice(0, last);
      const shown = await this.shownBeyond(only.stationId, access, filtered);
      const shownOutcomes =
        shown.length > 0
          ? await this.outcomes.of(
              shown.map((each) => each.runId),
              access.asOf,
            )
          : new Map();
      const listed = [...filtered, ...shown];

      return {
        kind: 'found',
        history: {
          line: { key: only.lineKey, name: only.lineName },
          station: { key: only.stationKey, name: only.stationName },
          configs: (
            await this.stations.configsNamed([
              ...new Set(listed.flatMap((each) => each.fingerprint ?? [])),
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
        },
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async shownBeyond(
    stationId: string,
    access: HistoryAccess,
    runs: readonly StationRunRow[],
  ): Promise<readonly StationRunRow[]> {
    return (
      await this.stations.endedAmong(stationId, access.shownBeyond(runs))
    ).filter((each) => !access.hides(each));
  }

  private async withOutcomes(
    runs: readonly StationRunRow[],
    station: string,
    outcomes: Outcomes,
  ): Promise<readonly HistoryRunDto[]> {
    const [written, usages] = await Promise.all([
      this.histories.written(runs, station),
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
}
