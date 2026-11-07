import type { ChangeStackBecameReady } from '@change-review/domain/events/change-stack-became-ready.event';
import type { StackChecked } from '@change-review/domain/events/stack-checked.event';
import type { TrialStackCompleted } from '@change-review/domain/events/trial-stack-completed.event';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
import {
  CHANGE_STACK_READY,
  type ChangeStackReadyIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-stack-ready.integration-event';
import {
  TRIAL_CHANGE_CHECKED,
  type TrialChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/trial-change-checked.integration-event';
import {
  TRIAL_CHANGE_RECHECKED,
  type TrialChangeRecheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/trial-change-rechecked.integration-event';
import {
  TRIAL_STACK_COMPLETED,
  type TrialStackCompletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/trial-stack-completed.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const CHANGE_REVIEW_EVENT_MAPPERS = [
  mapping<StackChecked>(
    'stack-check.checked',
    (
      event,
    ):
      | ChangeCheckedIntegrationEvent
      | TrialChangeCheckedIntegrationEvent
      | TrialChangeRecheckedIntegrationEvent => {
      if (event.checkId.recheck) {
        return {
          kind: TRIAL_CHANGE_RECHECKED,
          runId: event.runId.value,
          workspaceId: event.workspaceId.value,
          passed: event.passed,
        };
      }

      return event.trial
        ? {
            kind: TRIAL_CHANGE_CHECKED,
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
  mapping<ChangeStackBecameReady>(
    'change-stack.became-ready',
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
  mapping<TrialStackCompleted>(
    'change-stack.trial-completed',
    (event): TrialStackCompletedIntegrationEvent => ({
      kind: TRIAL_STACK_COMPLETED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;
