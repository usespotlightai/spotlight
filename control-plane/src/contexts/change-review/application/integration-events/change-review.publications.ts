import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackShaped } from '@change-review/domain/events/change-stack-shaped.event';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
import {
  CHANGE_STACK_SHAPED,
  type ChangeStackShapedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-stack-shaped.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const CHANGE_REVIEW_PUBLICATIONS = [
  publishing<ChangeStackChecked>(
    'change-stack.checked',
    (event): ChangeCheckedIntegrationEvent => ({
      kind: CHANGE_CHECKED,
      runId: event.runId.value,
      taskId: event.taskId?.value ?? null,
      workspaceId: event.workspaceId.value,
      passed: event.passed,
    }),
  ),
  publishing<ChangeStackShaped>(
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
] as const;
