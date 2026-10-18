import { periodOf } from '@insights/application/dto/insights.dto';
import type {
  ChangeMarkerDto,
  InsightsChangesDto,
} from '@insights/application/dto/insights-changes.dto';
import type { InsightsReaderPort } from '@insights/application/ports/insights-reader.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import type { ReadInsightsChangesQuery } from '@insights/application/queries/read-insights-changes.query';
import {
  type ConfigPair,
  configChangesOf,
  fingerprintsToRead,
} from '@insights/application/services/config-changes';
import type { QualifiedJudges } from '@insights/application/services/qualified-judges.service';
import type { TeamScopes } from '@insights/application/services/team-scopes.service';
import type { ChangeCounts } from '@insights/domain/services/before-after';
import { verdictsFrom } from '@insights/domain/services/change-verdict';
import {
  judgeDeltaOf,
  judgeRateFrom,
} from '@insights/domain/services/judge-rates';
import { tallyOf } from '@insights/domain/services/run-tally';
import type { StationLocation } from '@insights/domain/services/team-history';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const locationsOf = (
  locations: readonly StationLocation[],
): readonly StationLocation[] => [
  ...new Map(locations.map((each) => [each.stationId, each])).values(),
];

const pairOf = ({ marker }: ChangeCounts): ConfigPair => ({
  previous: marker.previousFingerprint,
  next: marker.fingerprint,
});

export class ReadInsightsChangesHandler
  implements QueryHandlerPort<ReadInsightsChangesQuery, InsightsChangesDto>
{
  constructor(
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly judges: QualifiedJudges,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadInsightsChangesQuery): Promise<InsightsChangesDto> {
    try {
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const changes = await this.reader.changeCounts({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        period,
      });
      const calibrations = await this.judges.calibrations(
        access,
        locationsOf(changes.map((each) => each.marker)),
      );
      const qualifiedStations = new Set(
        calibrations.judges
          .filter((each) => each.qualified)
          .map((each) => each.stationId),
      );
      const configs = configChangesOf(
        await this.work.configsInOrder(fingerprintsToRead(changes.map(pairOf))),
      );
      const markers: ChangeMarkerDto[] = changes.map((change) => {
        const { marker } = change;
        const qualifiedRubric =
          calibrations.qualified.get(marker.stationId) ?? null;
        const judgeBefore = qualifiedStations.has(marker.stationId)
          ? judgeRateFrom(change.judgedBefore, qualifiedRubric)
          : null;
        const judgeAfter = qualifiedStations.has(marker.stationId)
          ? judgeRateFrom(change.judgedAfter, qualifiedRubric)
          : null;

        return {
          lineId: marker.lineId,
          stationId: marker.stationId,
          fingerprint: marker.fingerprint,
          previousFingerprint: marker.previousFingerprint,
          firstRunAt: marker.firstRunAt.toISOString(),
          runId: marker.runId,
          before: tallyOf(change.before.tally),
          after: tallyOf(change.after.tally),
          verdicts: verdictsFrom(change.before, change.after),
          judgeBefore,
          judgeAfter,
          judgeChange: judgeDeltaOf(judgeBefore, judgeAfter),
          changes: configs.between(pairOf(change)),
        };
      });

      return {
        period: periodOf(period),
        markers,
        judges: calibrations.judges.map(
          ({ rubricVersion: _, ...each }) => each,
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
