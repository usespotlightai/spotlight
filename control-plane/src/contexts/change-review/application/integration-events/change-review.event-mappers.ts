import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackReady } from '@change-review/domain/events/change-stack-ready.event';
import type { ReplayStackCompleted } from '@change-review/domain/events/replay-stack-completed.event';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
import {
  CHANGE_STACK_READY,
  type ChangeStackReadyIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-stack-ready.integration-event';
import {
  REPLAY_CHANGE_CHECKED,
  type ReplayChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-change-checked.integration-event';
import {
  REPLAY_CHANGE_RECHECKED,
  type ReplayChangeRecheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-change-rechecked.integration-event';
import {
  REPLAY_STACK_COMPLETED,
  type ReplayStackCompletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-stack-completed.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const CHANGE_REVIEW_EVENT_MAPPERS = [
  mapping<ChangeStackChecked>(
    'change-stack.checked',
    (
      event,
    ):
      | ChangeCheckedIntegrationEvent
      | ReplayChangeCheckedIntegrationEvent
      | ReplayChangeRecheckedIntegrationEvent => {
      if (event.recheck) {
        return {
          kind: REPLAY_CHANGE_RECHECKED,
          runId: event.runId.value,
          workspaceId: event.workspaceId.value,
          passed: event.passed,
        };
      }

      return event.replay
        ? {
            kind: REPLAY_CHANGE_CHECKED,
            runId: event.runId.value,
            workspaceId: event.workspaceId.value,
            passed: event.passed,
          }
        : {
            kind: CHANGE_CHECKED,
            runId: event.runId.value,
            taskId: event.taskId?.value ?? null,
            workspaceId: event.workspaceId.value,
            passed: event.passed,
          };
    },
  ),
  mapping<ChangeStackReady>(
    'change-stack.ready',
    (event): ChangeStackReadyIntegrationEvent => {
      const changes = event.cohorts.filter((each) => each.kind === 'change');

      return {
        kind: CHANGE_STACK_READY,
        runId: event.runId.value,
        taskId: event.taskId?.value ?? null,
        workspaceId: event.workspaceId.value,
        changeTitles: changes.map((each) => each.title),
        changeIntents: changes.map((each) => each.intent),
        at: event.at.toISOString(),
      };
    },
  ),
  mapping<ReplayStackCompleted>(
    'change-stack.replay-completed',
    (event): ReplayStackCompletedIntegrationEvent => ({
      kind: REPLAY_STACK_COMPLETED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;
