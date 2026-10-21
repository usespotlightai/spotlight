import type { ConfigurationAuditPort } from '@identity/application/ports/configuration-audit.port';
import type { OidcTrustUsagePort } from '@identity/application/ports/oidc-trust-usage.port';
import type { OidcTrustDeleted } from '@identity/domain/events/oidc-trust-deleted.event';
import type { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import {
  type EventProjection,
  projecting,
} from '@shared-kernel/application/ports/event-projection.port';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

const issuedToken = (event: DomainEvent): event is WorkspaceTokenIssued =>
  event.kind === 'workspace-token.issued';

const deletedOidcTrust = (event: DomainEvent): event is OidcTrustDeleted =>
  event.kind === 'oidc-trust.deleted';

export const identityProjections = (
  audit: ConfigurationAuditPort,
  usage: OidcTrustUsagePort,
): readonly EventProjection[] => [
  projecting(
    'identity.audit-configuration-changes',
    changesConfiguration,
    (event) => audit.record(event.change),
  ),
  projecting('identity.record-oidc-trust-usage', issuedToken, async (event) => {
    if (event.issuedByTrustId) {
      await usage.issued(
        event.issuedByTrustId,
        event.workspaceId,
        event.issuedAt,
      );
    }
  }),
  projecting('identity.forget-oidc-trust-usage', deletedOidcTrust, (event) =>
    usage.forget(event.trustId),
  ),
];
