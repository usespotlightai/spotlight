import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsSetupsDto } from '@outcomes/application/dto/insights-changes.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { ReadInsightsSetupsQuery } from '@outcomes/application/queries/read-insights-setups.query';
import type { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import type { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import { InvalidSetupFilterError } from '@outcomes/domain/exceptions/invalid-setup-filter.error';
import {
  RUN_SIZES,
  runSizeOf,
  SIZE_BOUNDS,
} from '@outcomes/domain/services/run-size';
import {
  judgeWithheldFrom,
  MIN_SETUP_RUNS,
  setupsFrom,
} from '@outcomes/domain/services/setup-comparison';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
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
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly judges: TrustedJudges,
  ) {}

  async execute(query: ReadInsightsSetupsQuery): Promise<InsightsSetupsDto> {
    try {
      const size = sizeAsked(query.size);
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.setupCounts(
        {
          workspaceId: access.workspaceId,
          teamId: access.teamId,
          period,
        },
        { stationId: query.stationId, size },
      );
      const judgeWithheld = judgeWithheldFrom(query.stationId);
      const calibrations =
        query.stationId === null
          ? null
          : {
              stationId: query.stationId,
              ...(await this.judges.calibrations(access, counts.stations)),
            };
      const compared = setupsFrom(
        counts.setups,
        calibrations
          ? {
              withheld: false,
              trusted: calibrations.trusted.get(calibrations.stationId) ?? null,
            }
          : { withheld: true },
      );

      return {
        period: periodOf(period),
        stationId: query.stationId,
        size,
        sizes: SIZE_BOUNDS,
        minRuns: MIN_SETUP_RUNS,
        currency: compared.currency,
        setups: compared.setups,
        judgeWithheld,
        judges: (calibrations?.judges ?? []).map(
          ({ rubricVersion: _, ...each }) => each,
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
