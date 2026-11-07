import { ProjectPullRequestFacts } from '@insights/application/services/project-pull-request-facts.service';
import { ProjectRunFacts } from '@insights/application/services/project-run-facts.service';
import { DrizzlePullRequestFacts } from '@insights/infrastructure/persistence/drizzle/projections/pull-request-facts.projection';
import { DrizzleRunFacts } from '@insights/infrastructure/persistence/drizzle/projections/run-facts.projection';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleTaskChangeShapeRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-change-shape.repository';
import { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import { insightsProjections } from '@insights/presentation/events/insights.projections';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { EventProjection } from '@shared-kernel/application/ports/event-projection.port';

export const projectedInsights = (context: DrizzleContext) => {
  let projections: readonly EventProjection[] = [];
  const dispatcher: DomainEventDispatcher = {
    dispatch: async (events) => {
      for (const event of events) {
        for (const each of projections) {
          if (each.matches(event)) {
            await each.project(event);
          }
        }
      }
    },
  };
  const records = new DrizzleRunRecordRepository(context, dispatcher);
  const humanActions = new DrizzleTaskHumanActionsRepository(
    context,
    dispatcher,
  );
  const pullRequests = new DrizzlePullRequestRecordRepository(
    context,
    dispatcher,
  );
  const shapes = new DrizzleTaskChangeShapeRepository(context, dispatcher);
  const runFacts = new ProjectRunFacts(
    records,
    humanActions,
    pullRequests,
    new DrizzleRunFacts(context),
    context,
  );
  const pullRequestFacts = new ProjectPullRequestFacts(
    pullRequests,
    shapes,
    new DrizzlePullRequestFacts(context),
    context,
  );

  projections = insightsProjections(runFacts, pullRequestFacts);

  return {
    dispatcher,
    records,
    humanActions,
    pullRequests,
    shapes,
    runFacts,
    pullRequestFacts,
  };
};
