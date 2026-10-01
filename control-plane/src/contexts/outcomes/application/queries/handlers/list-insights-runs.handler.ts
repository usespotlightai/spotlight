import {
  type InsightsRunsDto,
  insightsRunOf,
  namedOf,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import { pageOf, sizeOf } from '@outcomes/application/queries/handlers/paging';
import type { ListInsightsRunsQuery } from '@outcomes/application/queries/list-insights-runs.query';
import {
  type TeamHistories,
  windowOf,
} from '@outcomes/application/services/team-histories.service';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { TaskTouchesRepository } from '@outcomes/domain/repositories/task-touches.repository';
import { runFilterOf } from '@outcomes/domain/services/run-filter';
import { pageAskedOf, pageWithin } from '@outcomes/domain/services/run-page';
import { tasksOf } from '@outcomes/domain/services/team-history';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ListInsightsRunsHandler
  implements QueryHandlerPort<ListInsightsRunsQuery, InsightsRunsDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly records: RunRecordRepository,
    private readonly touches: TaskTouchesRepository,
    private readonly deliveries: TaskDeliveryRepository,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ListInsightsRunsQuery): Promise<InsightsRunsDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const filter = runFilterOf(query.filter, period.current);
      const size = sizeOf(query.size);
      const page = pageAskedOf(pageOf(query.page));
      const listed = await this.records.listedForTeam({
        window: windowOf(clearance, period.current),
        filter,
        offset: (page - 1) * size,
        limit: size,
      });

      pageWithin(page, listed.total, size);
      const worked = tasksOf(listed.records).map((each) => TaskId.of(each));
      const openers = new Map(
        (await this.touches.forTasks(worked)).map((each) => [
          each.taskId.value,
          each.opening?.by?.value ?? null,
        ]),
      );
      const deliveries = new Map(
        (await this.deliveries.forTasks(worked)).map((each) => [
          each.taskId.value,
          each,
        ]),
      );
      const runs = listed.records.flatMap((record) => {
        const run = insightsRunOf(
          record,
          (record.taskId && openers.get(record.taskId.value)) ?? null,
          deliveries,
        );
        return run ? [run] : [];
      });
      const ids = runs.flatMap((each) =>
        each.openedBy ? [each.openedBy] : [],
      );

      return {
        period: periodOf(period),
        total: listed.total,
        page,
        size,
        runs,
        people: namedOf(ids, await this.people.namesOf(ids)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
