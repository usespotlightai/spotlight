import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
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
] as const;
