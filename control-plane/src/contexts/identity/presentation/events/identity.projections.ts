import type { ConfigurationAuditPort } from '@identity/application/ports/configuration-audit.port';
import {
  type EventProjection,
  projecting,
} from '@shared-kernel/application/ports/event-projection.port';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';

export const identityProjections = (
  audit: ConfigurationAuditPort,
): readonly EventProjection[] => [
  projecting(
    'identity.audit-configuration-changes',
    changesConfiguration,
    (event) => audit.record(event.change),
  ),
];
