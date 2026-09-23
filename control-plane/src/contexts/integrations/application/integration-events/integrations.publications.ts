import type { HostConnected } from '@integrations/domain/events/host-connected.event';
import type { HostRenewalRefused } from '@integrations/domain/events/host-renewal-refused.event';
import type { IntegrationDefined } from '@integrations/domain/events/integration-defined.event';
import type { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import type { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
import {
  HOST_CONNECTED,
  type HostConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-connected.integration-event';
import {
  HOST_RENEWAL_REFUSED,
  type HostRenewalRefusedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-renewal-refused.integration-event';
import {
  INTEGRATION_DEFINED,
  type IntegrationDefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/integration-defined.integration-event';
import {
  INTEGRATION_REDEFINED,
  type IntegrationRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/integration-redefined.integration-event';
import {
  INTEGRATION_RETIRED,
  type IntegrationRetiredIntegrationEvent,
} from '@shared-kernel/application/integration-events/integration-retired.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

type DefinitionEvent =
  | IntegrationDefined
  | IntegrationRedefined
  | IntegrationRetired;

const definitionFields = (event: DefinitionEvent) => ({
  integrationId: event.id.value,
  teamId: event.teamId.value,
  source: event.source.value,
  offers: [...event.offers],
});

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
  publishing<IntegrationDefined>(
    'integrations.integration-defined',
    (event): IntegrationDefinedIntegrationEvent => ({
      kind: INTEGRATION_DEFINED,
      ...definitionFields(event),
    }),
  ),
  publishing<IntegrationRedefined>(
    'integrations.integration-redefined',
    (event): IntegrationRedefinedIntegrationEvent => ({
      kind: INTEGRATION_REDEFINED,
      ...definitionFields(event),
    }),
  ),
  publishing<IntegrationRetired>(
    'integrations.integration-retired',
    (event): IntegrationRetiredIntegrationEvent => ({
      kind: INTEGRATION_RETIRED,
      ...definitionFields(event),
    }),
  ),
] as const;
