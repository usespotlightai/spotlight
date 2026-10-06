import { periodOf } from '@outcomes/application/dto/insights.dto';
import type {
  ChangeMarkerDto,
  InsightsChangesDto,
} from '@outcomes/application/dto/insights-changes.dto';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type { ReadInsightsChangesQuery } from '@outcomes/application/queries/read-insights-changes.query';
import {
  type ConfigPair,
  configChangesOf,
  fingerprintsAsked,
} from '@outcomes/application/services/config-changes';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import type { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  type ChangeSplit,
  changeSplitsOf,
} from '@outcomes/domain/services/before-after';
import { changeVerdictOf } from '@outcomes/domain/services/change-verdict';
import { judgeShareOf } from '@outcomes/domain/services/judge-shares';
import { runTally } from '@outcomes/domain/services/run-tally';
import {
  type StationPlace,
  startedWithin,
} from '@outcomes/domain/services/team-history';
import { within } from '@outcomes/domain/value-objects/insights-period.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const placesOf = (places: readonly StationPlace[]): readonly StationPlace[] => [
  ...new Map(places.map((each) => [each.stationId, each])).values(),
];

const pairOfSplit = (split: ChangeSplit): ConfigPair => ({
  previous: split.previousFingerprint,
  next: split.marker.fingerprint,
});

const sharesOf = (
  records: readonly RunRecord[],
  shares: ReadonlyMap<string, number>,
): number[] =>
  records.flatMap((each) => {
    const share = shares.get(each.runId.value);
    return share === undefined ? [] : [share];
  });

export class ReadInsightsChangesHandler
  implements QueryHandlerPort<ReadInsightsChangesQuery, InsightsChangesDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly judges: TrustedJudges,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadInsightsChangesQuery): Promise<InsightsChangesDto> {
    try {
      const held = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );
      const { clearance, period, history, truncated } = held;
      const carried = await this.histories.carriedOn(held);
      const splits = changeSplitsOf(
        startedWithin(history.records, {
          from: carried.from,
          to: period.lookback.to,
        }),
        (marker) => within(period.current, marker.firstRunAt),
        carried.lastRuns,
      );
      const judging = await this.judges.of(
        clearance,
        placesOf(splits.map((each) => each.marker)),
        splits.flatMap((each) => [...each.before, ...each.after]),
      );
      const trusted = new Set(
        judging.judges
          .filter((each) => each.trusted)
          .map((each) => each.stationId),
      );
      const configs = configChangesOf(
        await this.work.configsInOrder(
          fingerprintsAsked(splits.map(pairOfSplit)),
        ),
      );
      const markers: ChangeMarkerDto[] = splits.map((split) => {
        const { marker } = split;
        const judged = trusted.has(marker.stationId);

        return {
          lineId: marker.lineId,
          stationId: marker.stationId,
          fingerprint: marker.fingerprint,
          previousFingerprint: split.previousFingerprint,
          firstRunAt: marker.firstRunAt.toISOString(),
          runId: marker.runId,
          before: runTally(split.before, history.deliveries),
          after: runTally(split.after, history.deliveries),
          verdicts: changeVerdictOf(
            split.before,
            split.after,
            history.deliveries,
          ),
          judgeBefore: judged
            ? judgeShareOf(sharesOf(split.before, judging.shares))
            : null,
          judgeAfter: judged
            ? judgeShareOf(sharesOf(split.after, judging.shares))
            : null,
          changes: configs.between(pairOfSplit(split)),
        };
      });

      return {
        period: periodOf(period),
        truncated,
        markers,
        judges: judging.judges.map(({ rubricVersion: _, ...each }) => each),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
