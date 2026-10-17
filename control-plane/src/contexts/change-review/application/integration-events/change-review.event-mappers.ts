import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackShaped } from '@change-review/domain/events/change-stack-shaped.event';
import type { ReplayStackSettled } from '@change-review/domain/events/replay-stack-settled.event';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
import {
  CHANGE_STACK_SHAPED,
  type ChangeStackShapedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-stack-shaped.integration-event';
import {
  REPLAY_CHANGE_CHECKED,
  type ReplayChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-change-checked.integration-event';
import {
  REPLAY_CHANGE_RECHECKED,
  type ReplayChangeRecheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-change-rechecked.integration-event';
import {
  REPLAY_STACK_SETTLED,
  type ReplayStackSettledIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-stack-settled.integration-event';
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
  mapping<ChangeStackShaped>(
    'change-stack.shaped',
    (event): ChangeStackShapedIntegrationEvent => {
      const changes = event.cohorts.filter((each) => each.kind === 'change');

      return {
        kind: CHANGE_STACK_SHAPED,
        runId: event.runId.value,
        taskId: event.taskId?.value ?? null,
        workspaceId: event.workspaceId.value,
        changeTitles: changes.map((each) => each.title),
        changeIntents: changes.map((each) => each.intent),
        at: event.at.toISOString(),
      };
    },
  ),
  mapping<ReplayStackSettled>(
    'change-stack.replay-settled',
    (event): ReplayStackSettledIntegrationEvent => ({
      kind: REPLAY_STACK_SETTLED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;
