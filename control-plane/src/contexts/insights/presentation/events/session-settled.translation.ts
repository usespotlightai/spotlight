import type { SettledSession } from '@insights/application/ports/session-outcomes';
import type { AssistSessionSettledIntegrationEvent } from '@shared-kernel/application/integration-events/assist-session-settled.integration-event';

export const settledSessionOf = (
  event: AssistSessionSettledIntegrationEvent,
): SettledSession => ({
  workspaceId: event.workspaceId,
  purpose: event.purpose,
  key: event.key,
});
