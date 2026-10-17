import type { IntegrationConnected } from '@integrations/domain/events/integration-connected.event';
import {
  INTEGRATION_CONNECTED,
  type IntegrationConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/integration-connected.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const INTEGRATIONS_EVENT_MAPPERS = [
  mapping<IntegrationConnected>(
    'integrations.integration-connected',
    (event, at): IntegrationConnectedIntegrationEvent => ({
      kind: INTEGRATION_CONNECTED,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      integration: event.integration.value,
      personId: event.owner.personId?.value ?? null,
      at: at.toISOString(),
    }),
  ),
] as const;
