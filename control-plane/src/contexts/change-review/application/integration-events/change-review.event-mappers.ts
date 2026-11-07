import type { ChangeStackBecameReady } from '@change-review/domain/events/change-stack-became-ready.event';
import type { StackChecked } from '@change-review/domain/events/stack-checked.event';
import type { TrialStackSettled } from '@change-review/domain/events/trial-stack-settled.event';
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
  TRIAL_STACK_SETTLED,
  type TrialStackSettledIntegrationEvent,
} from '@shared-kernel/application/integration-events/trial-stack-settled.integration-event';
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
            at: event.at.toISOString(),
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
  mapping<TrialStackSettled>(
    'change-stack.trial-settled',
    (event): TrialStackSettledIntegrationEvent => ({
      kind: TRIAL_STACK_SETTLED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
    }),
  ),
] as const;
