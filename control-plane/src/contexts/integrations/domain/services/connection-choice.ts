import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import {
  ConnectionMissing,
  type ConnectionMissingReason,
} from '@integrations/domain/value-objects/connection-missing.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface Requester {
  readonly personId: UserId | null;
  readonly member: boolean;
}

export type ChosenConnection =
  | { readonly kind: 'owner'; readonly owner: ConnectionOwner }
  | { readonly kind: 'missing'; readonly missing: ConnectionMissing };

const missing = (
  integration: Integration,
  personId: UserId | null,
  because: ConnectionMissingReason,
): ConnectionMissing =>
  ConnectionMissing.of({
    integration: integration.key,
    integrationName: integration.name,
    personId,
    because,
  });

export const ConnectionChoice = {
  choose(integration: Integration, requester: Requester): ChosenConnection {
    if (!integration.actsAs.byRequester) {
      return { kind: 'owner', owner: ConnectionOwner.team() };
    }

    if (!requester.personId) {
      return {
        kind: 'missing',
        missing: missing(integration, null, 'no-requester'),
      };
    }

    if (!requester.member) {
      return {
        kind: 'missing',
        missing: missing(integration, requester.personId, 'not-a-member'),
      };
    }

    return {
      kind: 'owner',
      owner: ConnectionOwner.person(requester.personId),
    };
  },

  usable(
    integration: Integration,
    owner: ConnectionOwner,
    found: IntegrationConnection | null,
  ): ConnectionMissing | null {
    if (!owner.isPerson) {
      return null;
    }

    if (!found) {
      return missing(integration, owner.personId, 'not-connected');
    }

    return found.usable
      ? null
      : missing(integration, owner.personId, 'refresh-failed');
  },
};
