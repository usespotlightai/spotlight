import type { HostConnected } from '@integrations/domain/events/host-connected.event';
import {
  HOST_CONNECTED,
  type HostConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-connected.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const INTEGRATIONS_PUBLICATIONS = [
  publishing<HostConnected>(
    'integrations.host-connected',
    (event): HostConnectedIntegrationEvent => ({
      kind: HOST_CONNECTED,
      teamId: event.teamId.value,
      source: event.source.value,
      handle: event.handle,
    }),
  ),
] as const;
