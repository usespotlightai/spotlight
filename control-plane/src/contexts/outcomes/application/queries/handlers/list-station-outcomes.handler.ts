import { runOutcomeOf } from '@outcomes/application/dto/run-outcome.dto';
import type {
  FingerprintGroupDto,
  StationOutcomesDto,
} from '@outcomes/application/dto/station-outcomes.dto';
import type {
  ConfigInOrder,
  WorkPort,
} from '@outcomes/application/ports/work.port';
import type { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import {
  type FingerprintGroup,
  fingerprintGroupsNewestFirst,
} from '@outcomes/domain/services/fingerprint-groups';
import { stationTally } from '@outcomes/domain/services/station-tally';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const DEFAULT_LAST = 50;
const MOST_LAST = 200;

const lastOf = (asked: number | null): number =>
  asked !== null && Number.isInteger(asked) && asked > 0
    ? Math.min(asked, MOST_LAST)
    : DEFAULT_LAST;

const configsAlong = (
  oldestFirst: readonly FingerprintGroup[],
  configs: readonly ConfigInOrder[],
): (ConfigInOrder | null)[] => {
  let at = 0;

  return oldestFirst.map((group) => {
    const config = configs[at];

    if (
      group.fingerprint !== null &&
      config?.fingerprint === group.fingerprint
    ) {
      at += 1;
      return config;
    }

    return null;
  });
};

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
      const records = await this.records.lastAtStation({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        lineId: query.lineId,
        stationId: query.stationId,
        last: lastOf(query.last),
      });
      const deliveries = await this.deliveries.forTasks(
        records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      );
      const costs = await this.work.costsOf(
        records.map((each) => each.runId.value),
      );
      const oldestFirst = [...fingerprintGroupsNewestFirst(records)].reverse();
      const configs = configsAlong(
        oldestFirst,
        await this.work.configsInOrder(
          oldestFirst.flatMap((each) =>
            each.fingerprint === null ? [] : [each.fingerprint],
          ),
        ),
      );

      const groups: FingerprintGroupDto[] = oldestFirst.map((group, at) => {
        const config = configs[at] ?? null;

        return {
          fingerprint: group.fingerprint,
          config: config?.config ?? null,
          changes: config?.changes ?? [],
          runs: group.records.flatMap((each) => {
            const outcome = runOutcomeOf(each, deliveries, costs);
            return outcome ? [outcome] : [];
          }),
          tally: stationTally(group.records, deliveries, costs),
        };
      });

      return { stationId: query.stationId, groups: groups.reverse() };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
