import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { ActsAsKind } from '@integrations/domain/value-objects/acts-as.vo';
import {
  ConnectionMissing,
  type ConnectionMissingReason,
} from '@integrations/domain/value-objects/connection-missing.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { Integration } from '@integrations/domain/value-objects/integration.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface ActingAs {
  readonly actsAs: ActsAsKind;
  readonly personId: UserId | null;
  readonly linkedAccount: string | null;
}

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
  actingAs(
    integration: Integration,
    owner: ConnectionOwner,
    connection: IntegrationConnection | null,
  ): ActingAs | null {
    return integration.requiresConnection
      ? {
          actsAs: owner.isPerson ? 'requester' : 'team',
          personId: owner.personId,
          linkedAccount: connection?.linkedAccount ?? null,
        }
      : null;
  },

  forUnrequestedCall(integration: Integration): ConnectionOwner | null {
    return integration.requiresConnection ? ConnectionOwner.team() : null;
  },

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
