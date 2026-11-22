import { ASSIST_OWNER } from '@assist/application/ports/runs.port';
import type { AssistSessions } from '@assist/application/services/assist-sessions.service';
import type { AssistSessionOrdered } from '@assist/domain/events/assist-session-ordered.event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
  type RunRequesterPublished,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  RUN_USAGE_RECORDED,
  type RunUsageRecordedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-usage-recorded.integration-event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

const requestedAnAssist = (event: {
  readonly requester: RunRequesterPublished;
}): boolean => event.requester.owner === ASSIST_OWNER;

export const assistSubscribers = (
  sessions: AssistSessions,
): readonly DomainEventSubscriber[] => [
  subscribing<AssistSessionOrdered>(
    'assist.enqueue-session-run',
    ['assist.session-ordered'],
    (event) =>
      sessions.enqueueRun({
        runId: event.run.value,
        briefing: event.briefing,
        files: event.files,
      }),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'assist.settle-session-of-ended-run',
    [RUN_ENDED],
    async (event) => {
      if (!requestedAnAssist(event)) {
        return;
      }

      await sessions.runEnded({
        runId: event.runId,
        failed: event.outcome !== 'completed',
        endedAt: new Date(event.endedAt),
      });
    },
  ),
  subscribing<RunUsageRecordedIntegrationEvent>(
    'assist.record-session-usage',
    [RUN_USAGE_RECORDED],
    async (event) => {
      if (!requestedAnAssist(event)) {
        return;
      }

      await sessions.usageRecorded({
        runId: event.runId,
        call: {
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          cost:
            event.cost !== null && event.currency !== null
              ? { amount: event.cost, currency: event.currency }
              : null,
        },
      });
    },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'assist.delete-sessions-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => sessions.workspaceDeleted(event.workspaceId),
  ),
];
