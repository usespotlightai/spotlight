import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import {
  type ConnectionWant,
  ConnectionWanted,
} from '@integrations/domain/value-objects/connection-wanted.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface Requester {
  readonly personId: UserId | null;
  readonly member: boolean;
}

export type ChosenConnection =
  | { readonly kind: 'holder'; readonly holder: ConnectionHolder }
  | { readonly kind: 'wanted'; readonly wanted: ConnectionWanted };

const wanted = (
  integration: Integration,
  personId: UserId | null,
  because: ConnectionWant,
): ConnectionWanted =>
  ConnectionWanted.of({
    source: integration.source,
    integrationName: integration.name,
    personId,
    because,
  });

export const ConnectionChoice = {
  choose(integration: Integration, requester: Requester): ChosenConnection {
    if (!integration.holderRule.byRequester) {
      return { kind: 'holder', holder: ConnectionHolder.team() };
    }

    if (!requester.personId) {
      return {
        kind: 'wanted',
        wanted: wanted(integration, null, 'no-requester'),
      };
    }

    if (!requester.member) {
      return {
        kind: 'wanted',
        wanted: wanted(integration, requester.personId, 'not-a-member'),
      };
    }

    return {
      kind: 'holder',
      holder: ConnectionHolder.person(requester.personId),
    };
  },

  usable(
    integration: Integration,
    holder: ConnectionHolder,
    found: HostConnection | null,
  ): ConnectionWanted | null {
    if (!holder.isPerson) {
      return null;
    }

    if (!found) {
      return wanted(integration, holder.personId, 'not-connected');
    }

    return found.usable
      ? null
      : wanted(integration, holder.personId, 'renewal-refused');
  },
};
