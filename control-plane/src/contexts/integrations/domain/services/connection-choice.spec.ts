import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { ConnectionChoice } from '@integrations/domain/services/connection-choice';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const LINEAR = IntegrationKey.of('linear');
const ALICE = UserId.of('user_alice');
const NOW = new Date('2026-10-05T10:00:00.000Z');

const integration = (actsAs = ActsAs.requester()) =>
  Integration.of({
    key: LINEAR,
    name: 'Linear',
    requiresConnection: true,
    actsAs,
  });

const connected = (owner: ConnectionOwner) =>
  IntegrationConnection.connectFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    integration: LINEAR,
    owner,
    tokens: OAuthTokens.of({ accessToken: 'lin-1', refreshToken: 'lin-r-1' }),
  });

describe('ConnectionChoice', () => {
  describe('choose', () => {
    it('takes the team’s connection for an integration that acts as the team, whoever requested it', () => {
      for (const personId of [ALICE, null]) {
        expect(
          ConnectionChoice.choose(integration(ActsAs.team()), {
            personId,
            member: false,
          }),
        ).toEqual({ kind: 'owner', owner: ConnectionOwner.team() });
      }
    });

    it('takes the requester’s own connection when they are on the team', () => {
      const chosen = ConnectionChoice.choose(integration(), {
        personId: ALICE,
        member: true,
      });

      expect(chosen.kind === 'owner' && chosen.owner.personId).toEqual(ALICE);
    });

    it('wants a requester where nobody started the task', () => {
      const chosen = ConnectionChoice.choose(integration(), {
        personId: null,
        member: false,
      });

      expect(chosen.kind === 'missing' && chosen.missing.because).toBe(
        'no-requester',
      );
    });

    it('denies a requester who is no longer on the team', () => {
      const chosen = ConnectionChoice.choose(integration(), {
        personId: ALICE,
        member: false,
      });

      expect(chosen.kind === 'missing' && chosen.missing.because).toBe(
        'not-a-member',
      );
    });
  });

  describe('usable', () => {
    const ALICES = ConnectionOwner.person(ALICE);

    it('asks the person to connect when they have not, never falling back to the team', () => {
      const missing = ConnectionChoice.usable(integration(), ALICES, null);

      expect(missing?.because).toBe('not-connected');
      expect(missing?.personId).toEqual(ALICE);
      expect(missing?.integrationName).toBe('Linear');
    });

    it('asks the person to connect again once the refresh of their token failed', () => {
      const failed = connected(ALICES).refreshFailed(NOW);

      expect(
        ConnectionChoice.usable(integration(), ALICES, failed)?.because,
      ).toBe('refresh-failed');
    });

    it('uses a person’s connection they own', () => {
      expect(
        ConnectionChoice.usable(integration(), ALICES, connected(ALICES)),
      ).toBeNull();
    });

    it('lets the team go on without a connection, as it always has', () => {
      expect(
        ConnectionChoice.usable(
          integration(ActsAs.team()),
          ConnectionOwner.team(),
          null,
        ),
      ).toBeNull();
    });
  });
});
