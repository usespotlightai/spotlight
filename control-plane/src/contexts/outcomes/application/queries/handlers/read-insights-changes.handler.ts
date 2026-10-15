import { periodOf } from '@outcomes/application/dto/insights.dto';
import type {
  ChangeMarkerDto,
  InsightsChangesDto,
} from '@outcomes/application/dto/insights-changes.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type { ReadInsightsChangesQuery } from '@outcomes/application/queries/read-insights-changes.query';
import {
  type ConfigPair,
  configChangesOf,
  fingerprintsAsked,
} from '@outcomes/application/services/config-changes';
import type { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import type { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import type { ChangeCounts } from '@outcomes/domain/services/before-after';
import { verdictsFrom } from '@outcomes/domain/services/change-verdict';
import {
  judgeChangeOf,
  judgeShareFrom,
} from '@outcomes/domain/services/judge-shares';
import { tallyOf } from '@outcomes/domain/services/run-tally';
import type { StationPlace } from '@outcomes/domain/services/team-history';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const placesOf = (places: readonly StationPlace[]): readonly StationPlace[] => [
  ...new Map(places.map((each) => [each.stationId, each])).values(),
];

const pairOf = ({ marker }: ChangeCounts): ConfigPair => ({
  previous: marker.previousFingerprint,
  next: marker.fingerprint,
});

export class ReadInsightsChangesHandler
  implements QueryHandlerPort<ReadInsightsChangesQuery, InsightsChangesDto>
{
  constructor(
    private readonly histories: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly judges: TrustedJudges,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadInsightsChangesQuery): Promise<InsightsChangesDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const changes = await this.reader.changeCounts({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        period,
      });
      const standings = await this.judges.standings(
        clearance,
        placesOf(changes.map((each) => each.marker)),
      );
      const trustedStations = new Set(
        standings.judges
          .filter((each) => each.trusted)
          .map((each) => each.stationId),
      );
      const configs = configChangesOf(
        await this.work.configsInOrder(fingerprintsAsked(changes.map(pairOf))),
      );
      const markers: ChangeMarkerDto[] = changes.map((change) => {
        const { marker } = change;
        const trustedRubric = standings.trusted.get(marker.stationId) ?? null;
        const judgeBefore = trustedStations.has(marker.stationId)
          ? judgeShareFrom(change.judgedBefore, trustedRubric)
          : null;
        const judgeAfter = trustedStations.has(marker.stationId)
          ? judgeShareFrom(change.judgedAfter, trustedRubric)
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
          judgeChange: judgeChangeOf(judgeBefore, judgeAfter),
          changes: configs.between(pairOf(change)),
        };
      });

      return {
        period: periodOf(period),
        truncated: false,
        markers,
        judges: standings.judges.map(({ rubricVersion: _, ...each }) => each),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
