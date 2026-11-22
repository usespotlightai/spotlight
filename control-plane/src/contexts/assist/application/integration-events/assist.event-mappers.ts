import type { AssistSessionSettled } from '@assist/domain/events/assist-session-settled.event';
import {
  ASSIST_SESSION_SETTLED,
  type AssistSessionSettledIntegrationEvent,
} from '@shared-kernel/application/integration-events/assist-session-settled.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const ASSIST_EVENT_MAPPERS = [
  mapping<AssistSessionSettled>(
    'assist.session-settled',
    (event): AssistSessionSettledIntegrationEvent => ({
      kind: ASSIST_SESSION_SETTLED,
      workspaceId: event.workspaceId.value,
      purpose: event.purpose.value,
      key: event.key.value,
      outcome: event.outcome,
    }),
  ),
] as const;
