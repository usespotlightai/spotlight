import { runOutcomeOf } from '@outcomes/application/dto/run-outcome.dto';
import type {
  FingerprintGroupDto,
  StationOutcomesDto,
} from '@outcomes/application/dto/station-outcomes.dto';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import {
  configChangesOf,
  fingerprintsAsked,
} from '@outcomes/application/services/config-changes';
import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import {
  configInForce,
  daySpanOf,
  fingerprintGroupsNewestFirst,
} from '@outcomes/domain/services/fingerprint-groups';
import { runTally, tallySharesOf } from '@outcomes/domain/services/run-tally';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const DEFAULT_LAST = 50;
const MOST_LAST = 200;

const lastOf = (asked: number | null): number =>
  asked !== null && Number.isInteger(asked) && asked > 0
    ? Math.min(asked, MOST_LAST)
    : DEFAULT_LAST;

export class ListStationOutcomesHandler
  implements QueryHandlerPort<ListStationOutcomesQuery, StationOutcomesDto>
{
  constructor(
    private readonly access: OutcomesAccess,
    private readonly records: RunRecordRepository,
    private readonly deliveries: TaskDeliveryRepository,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ListStationOutcomesQuery): Promise<StationOutcomesDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.viewerId,
      );
      const records = await this.records.latestStartedAtStation({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        lineId: query.lineId,
        stationId: query.stationId,
        last: lastOf(query.last),
      });
      const deliveries = await this.deliveries.forTasks(
        records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      );
      const oldest = records[records.length - 1];
      const carried = oldest?.end
        ? await this.records.lastConfigRunsBefore(clearance.teamId, [
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
        await this.work.configsInOrder(fingerprintsAsked([...pairs].reverse())),
      );

      const groups: FingerprintGroupDto[] = newestFirst.map((group, at) => {
        const tally = runTally(group.records, deliveries);

        return {
          firstRunId: group.firstRunId.value,
          fingerprint: group.fingerprint,
          ran: group.ran,
          config: configs.configOf(group.fingerprint),
          changes: configs.between(pairs[at]),
          runs: group.records.flatMap((each) => {
            const outcome = runOutcomeOf(each, deliveries);
            return outcome ? [outcome] : [];
          }),
          tally,
          shares: tallySharesOf(tally),
          ...daySpanOf(group.records),
        };
      });

      const inForce = configInForce(newestFirst);

      return {
        stationId: query.stationId,
        groups,
        inForce: inForce
          ? { tally: runTally(inForce.records, deliveries) }
          : null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
