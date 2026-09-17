import {
  HOST_CONNECTED,
  type HostConnectedIntegrationEvent,
} from '@integrations/application/integration-events/host-connected.integration-event';
import {
  HOST_RENEWAL_REFUSED,
  type HostRenewalRefusedIntegrationEvent,
} from '@integrations/application/integration-events/host-renewal-refused.integration-event';
import type { HostConnected } from '@integrations/domain/events/host-connected.event';
import type { HostRenewalRefused } from '@integrations/domain/events/host-renewal-refused.event';
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
  publishing<HostRenewalRefused>(
    'integrations.host-renewal-refused',
    (event): HostRenewalRefusedIntegrationEvent => ({
      kind: HOST_RENEWAL_REFUSED,
      teamId: event.teamId.value,
      source: event.source.value,
      refusedAt: event.refusedAt.toISOString(),
    }),
  ),
] as const;
