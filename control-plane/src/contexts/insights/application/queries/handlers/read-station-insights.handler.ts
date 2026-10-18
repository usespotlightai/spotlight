import { runOutcomeOf } from '@insights/application/dto/run-outcome.dto';
import type {
  FingerprintGroupDto,
  StationInsightsDto,
} from '@insights/application/dto/station-insights.dto';
import type { StationConfigPullRequestsPort } from '@insights/application/ports/station-config-pull-requests.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import type { ReadStationInsightsQuery } from '@insights/application/queries/read-station-insights.query';
import {
  configChangesOf,
  fingerprintsToRead,
} from '@insights/application/services/config-changes';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import {
  configInForce,
  daySpanOf,
  fingerprintGroupsNewestFirst,
} from '@insights/domain/services/fingerprint-groups';
import { runTally, tallyRatesOf } from '@insights/domain/services/run-tally';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const DEFAULT_LAST = 50;
const MAX_LAST = 200;

const lastOf = (requested: number | null): number =>
  requested !== null && Number.isInteger(requested) && requested > 0
    ? Math.min(requested, MAX_LAST)
    : DEFAULT_LAST;

export class ReadStationInsightsHandler
  implements QueryHandlerPort<ReadStationInsightsQuery, StationInsightsDto>
{
  constructor(
    private readonly access: InsightsAccess,
    private readonly records: RunRecordRepository,
    private readonly taskPullRequests: TaskPullRequestRepository,
    private readonly pullRequests: StationConfigPullRequestsPort,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadStationInsightsQuery): Promise<StationInsightsDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.viewerId);
      const records = await this.records.latestStartedAtStation({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        lineId: query.lineId,
        stationId: query.stationId,
        last: lastOf(query.last),
      });
      const taskPullRequests = await this.taskPullRequests.forTasks(
        records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      );
      const oldest = records[records.length - 1];
      const carried = oldest?.end
        ? await this.records.lastConfigRunsBefore(access.teamId, [
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
        const tally = runTally(group.records, taskPullRequests);
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
          runs: group.records.flatMap((each) => {
            const outcome = runOutcomeOf(each, taskPullRequests);
            return outcome ? [outcome] : [];
          }),
          tally,
          rates: tallyRatesOf(tally),
          ...daySpanOf(group.records),
        };
      });

      const inForce = configInForce(newestFirst);

      return {
        stationId: query.stationId,
        groups,
        inForce: inForce
          ? { tally: runTally(inForce.records, taskPullRequests) }
          : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
