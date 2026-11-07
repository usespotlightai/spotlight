import { runOutcomeOf } from '@insights/application/dto/run-outcome.dto';
import type {
  FingerprintGroupDto,
  StationInsightsDto,
} from '@insights/application/dto/station-insights.dto';
import type { StationConfigPullRequestsPort } from '@insights/application/ports/station-config-pull-requests.port';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import {
  configChangesOf,
  fingerprintsToRead,
} from '@insights/application/queries/config-changes';
import type { ReadStationInsightsQuery } from '@insights/application/queries/read-station-insights.query';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import {
  runFailureSummaries,
  taskFailureSummaries,
} from '@insights/domain/services/failure-summaries';
import {
  configInForce,
  daySpanOf,
  fingerprintGroupsNewestFirst,
} from '@insights/domain/services/fingerprint-groups';
import { runTally, tallyRatesOf } from '@insights/domain/services/run-tally';
import { listingSizeOf } from '@insights/domain/value-objects/listing.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class ReadStationInsightsHandler
  implements QueryHandlerPort<ReadStationInsightsQuery, StationInsightsDto>
{
  constructor(
    private readonly access: InsightsAccess,
    private readonly facts: StationFactsPort,
    private readonly pullRequests: StationConfigPullRequestsPort,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadStationInsightsQuery): Promise<StationInsightsDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.viewerId);
      const records = await this.facts.latestStartedAt({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        lineId: query.lineId === null ? null : LineId.of(query.lineId),
        stationId: StationId.of(query.stationId),
        last: listingSizeOf(query.last),
      });
      const oldest = records[records.length - 1];
      const carried = oldest
        ? await this.facts.lastConfigRunsBefore(access.teamId, [
            {
              stationId: query.stationId,
              from: oldest.end.beganAt,
              fromRun: oldest.runId,
            },
          ])
        : [];
      const newestFirst = fingerprintGroupsNewestFirst(records, carried);
      const pairs = newestFirst.map((group) => ({
        previous: group.previous,
        next: group.fingerprint,
      }));
      const configs = configChangesOf(
        await this.work.configsInOrder(
          fingerprintsToRead([...pairs].reverse()),
        ),
      );
      const pullRequests = await this.pullRequests.newestFor(
        {
          workspaceId: access.workspaceId,
          teamId: access.teamId,
          stationId: query.stationId,
        },
        [
          ...new Set(
            newestFirst.flatMap((group) =>
              group.fingerprint ? [group.fingerprint] : [],
            ),
          ),
        ],
      );

      const groups: FingerprintGroupDto[] = newestFirst.map((group, at) => {
        const tally = runTally(group.records);
        const pullRequest =
          group.fingerprint !== null
            ? pullRequests.get(group.fingerprint)
            : null;

        return {
          firstRunId: group.firstRunId.value,
          fingerprint: group.fingerprint,
          ran: group.ran,
          config: configs.configOf(group.fingerprint),
          changes: configs.between(pairs[at]),
          pullRequest: pullRequest ? { url: pullRequest.value } : null,
          runs: group.records.map(runOutcomeOf),
          tally,
          rates: tallyRatesOf(tally),
          ...daySpanOf(group.records),
        };
      });

      const inForce = configInForce(newestFirst);
      const taskFailures = inForce
        ? await this.facts.failuresOfRuns(
            inForce.records.map((each) => each.runId),
          )
        : [];

      return {
        stationId: query.stationId,
        groups,
        inForce: inForce
          ? {
              tally: runTally(inForce.records),
              taskFailures: taskFailureSummaries(taskFailures),
              runFailures: runFailureSummaries(inForce.records),
            }
          : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
