import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { ConnectionChoice } from '@integrations/domain/services/connection-choice';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { ConnectionHolderRule } from '@integrations/domain/value-objects/connection-holder-rule.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const LINEAR = SourceKey.of('linear');
const ALICE = UserId.of('user_alice');
const NOW = new Date('2026-10-05T10:00:00.000Z');

const integration = (holder = ConnectionHolderRule.requester()) =>
  Integration.of({
    source: LINEAR,
    name: 'Linear',
    connects: true,
    holder,
  });

const connected = (holder: ConnectionHolder) =>
  HostConnection.linkFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    source: LINEAR,
    holder,
    grant: HostGrant.of({ accessToken: 'lin-1', refreshToken: 'lin-r-1' }),
  });

describe('ConnectionChoice', () => {
  describe('choose', () => {
    it('takes the team’s connection for an integration that acts as the team, whoever asked', () => {
      for (const personId of [ALICE, null]) {
        expect(
          ConnectionChoice.choose(integration(ConnectionHolderRule.team()), {
            personId,
            member: false,
          }),
        ).toEqual({ kind: 'holder', holder: ConnectionHolder.team() });
      }
    });

    it('takes the requester’s own connection when they are on the team', () => {
      const chosen = ConnectionChoice.choose(integration(), {
        personId: ALICE,
        member: true,
      });

      expect(chosen.kind === 'holder' && chosen.holder.personId).toEqual(ALICE);
    });

    it('wants a requester where nobody started the task', () => {
      const chosen = ConnectionChoice.choose(integration(), {
        personId: null,
        member: false,
      });

      expect(chosen.kind === 'wanted' && chosen.wanted.because).toBe(
        'no-requester',
      );
    });

    it('refuses a requester who is no longer on the team', () => {
      const chosen = ConnectionChoice.choose(integration(), {
        personId: ALICE,
        member: false,
      });

      expect(chosen.kind === 'wanted' && chosen.wanted.because).toBe(
        'not-a-member',
      );
    });
  });

  describe('usable', () => {
    const ALICES = ConnectionHolder.person(ALICE);

    it('asks the person to connect when they have not, never falling back to the team', () => {
      const wanted = ConnectionChoice.usable(integration(), ALICES, null);

      expect(wanted?.because).toBe('not-connected');
      expect(wanted?.personId).toEqual(ALICE);
      expect(wanted?.integrationName).toBe('Linear');
    });

    it('asks the person to connect again once the host refused to renew theirs', () => {
      const refused = connected(ALICES).renewalRefused(NOW);

      expect(
        ConnectionChoice.usable(integration(), ALICES, refused)?.because,
      ).toBe('renewal-refused');
    });

    it('uses a person’s connection they own', () => {
      expect(
        ConnectionChoice.usable(integration(), ALICES, connected(ALICES)),
      ).toBeNull();
    });

    it('lets the team go on without a connection, as it always has', () => {
      expect(
        ConnectionChoice.usable(
          integration(ConnectionHolderRule.team()),
          ConnectionHolder.team(),
          null,
        ),
      ).toBeNull();
    });
  });
});
