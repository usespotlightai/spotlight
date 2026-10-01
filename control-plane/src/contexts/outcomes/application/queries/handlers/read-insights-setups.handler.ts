import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsSetupsDto } from '@outcomes/application/dto/insights-changes.dto';
import type { ReadInsightsSetupsQuery } from '@outcomes/application/queries/read-insights-setups.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import type { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import { InvalidSetupFilterError } from '@outcomes/domain/exceptions/invalid-setup-filter.error';
import {
  RUN_SIZES,
  runSizeOf,
  SIZE_BOUNDS,
  sizeOf,
} from '@outcomes/domain/services/run-size';
import {
  FEWEST_SETUP_RUNS,
  judgeWithheldFrom,
  setupsCompared,
} from '@outcomes/domain/services/setup-comparison';
import {
  endedWithin,
  stationsOf,
} from '@outcomes/domain/services/team-history';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const sizeAsked = (raw: string | null) => {
  if (raw === null) {
    return null;
  }

  const size = runSizeOf(raw);

  if (!size) {
    throw new InvalidSetupFilterError(
      `by a size of ${RUN_SIZES.join(', ')}, not ${raw}`,
    );
  }

  return size;
};

export class ReadInsightsSetupsHandler
  implements QueryHandlerPort<ReadInsightsSetupsQuery, InsightsSetupsDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly judges: TrustedJudges,
  ) {}

  async execute(query: ReadInsightsSetupsQuery): Promise<InsightsSetupsDto> {
    try {
      const size = sizeAsked(query.size);
      const { clearance, period, history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );
      const records = endedWithin(history.records, period.current).filter(
        (each) =>
          (query.stationId === null ||
            each.end?.place.stationId === query.stationId) &&
          (size === null || sizeOf(each) === size),
      );
      const judgeWithheld = judgeWithheldFrom(query.stationId);
      const judging = judgeWithheld
        ? null
        : await this.judges.of(clearance, stationsOf(records), records);
      const compared = setupsCompared(
        records,
        history.deliveries,
        judging?.shares ?? null,
      );

      return {
        period: periodOf(period),
        truncated,
        stationId: query.stationId,
        size,
        sizes: SIZE_BOUNDS,
        fewestRuns: FEWEST_SETUP_RUNS,
        currency: compared.currency,
        setups: compared.setups,
        judgeWithheld,
        judges: (judging?.judges ?? []).map(
          ({ rubricVersion: _, ...each }) => each,
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
