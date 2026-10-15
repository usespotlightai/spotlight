import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsSetupsDto } from '@outcomes/application/dto/insights-changes.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { ReadInsightsSetupsQuery } from '@outcomes/application/queries/read-insights-setups.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import type { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import { InvalidSetupFilterError } from '@outcomes/domain/exceptions/invalid-setup-filter.error';
import {
  RUN_SIZES,
  runSizeOf,
  SIZE_BOUNDS,
} from '@outcomes/domain/services/run-size';
import {
  FEWEST_SETUP_RUNS,
  judgeWithheldFrom,
  setupsFrom,
} from '@outcomes/domain/services/setup-comparison';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const sizeAsked = (raw: string | null) => {
  if (raw === null) {
    return null;
  }

  const size = runSizeOf(raw);

  if (!size) {
    throw new InvalidSetupFilterError(
      `size must be one of ${RUN_SIZES.join(', ')}, not ${raw}`,
    );
  }

  return size;
};

export class ReadInsightsSetupsHandler
  implements QueryHandlerPort<ReadInsightsSetupsQuery, InsightsSetupsDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly reader: InsightsReaderPort,
    private readonly judges: TrustedJudges,
  ) {}

  async execute(query: ReadInsightsSetupsQuery): Promise<InsightsSetupsDto> {
    try {
      const size = sizeAsked(query.size);
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.setupCounts(
        {
          workspaceId: clearance.workspaceId,
          teamId: clearance.teamId,
          period,
        },
        { stationId: query.stationId, size },
      );
      const judgeWithheld = judgeWithheldFrom(query.stationId);
      const standings =
        query.stationId === null
          ? null
          : {
              stationId: query.stationId,
              ...(await this.judges.standings(clearance, counts.stations)),
            };
      const compared = setupsFrom(
        counts.setups,
        standings
          ? {
              withheld: false,
              trusted: standings.trusted.get(standings.stationId) ?? null,
            }
          : { withheld: true },
      );

      return {
        period: periodOf(period),
        truncated: false,
        stationId: query.stationId,
        size,
        sizes: SIZE_BOUNDS,
        fewestRuns: FEWEST_SETUP_RUNS,
        currency: compared.currency,
        setups: compared.setups,
        judgeWithheld,
        judges: (standings?.judges ?? []).map(
          ({ rubricVersion: _, ...each }) => each,
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
