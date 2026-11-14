import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ADA = UserId.of('user_ada');

describe('ConnectionOwner', () => {
  it('is the team for a connection that acts as the team', () => {
    expect(
      ConnectionOwner.actingAs(ActsAs.team(), ADA).equals(
        ConnectionOwner.team(),
      ),
    ).toBe(true);
  });

  it('is the person who connects for a connection that acts as the requester', () => {
    const owner = ConnectionOwner.actingAs(ActsAs.requester(), ADA);

    expect(owner.personId?.equals(ADA)).toBe(true);
    expect(owner.actsAs.byRequester).toBe(true);
  });

  it('acts as the team when nobody chose', () => {
    expect(ActsAs.chosen(null).equals(ActsAs.team())).toBe(true);
    expect(ConnectionOwner.team().actsAs.equals(ActsAs.team())).toBe(true);
  });

  it('lets only a workspace admin connect the team account', () => {
    expect(() =>
      ConnectionOwner.team().assertConnectableBy(ADA, true),
    ).not.toThrow();
    expect(() =>
      ConnectionOwner.team().assertConnectableBy(ADA, false),
    ).toThrow(
      expect.objectContaining({
        kind: 'not-allowed',
        denial: 'not-workspace-admin',
        message: 'Only a workspace owner or admin can connect a team account.',
      }),
    );
  });

  it('lets only its person connect a personal account', () => {
    expect(() =>
      ConnectionOwner.person(ADA).assertConnectableBy(ADA, false),
    ).not.toThrow();
    expect(() =>
      ConnectionOwner.person(ADA).assertConnectableBy(
        UserId.of('user_bea'),
        true,
      ),
    ).toThrow(expect.objectContaining({ denial: 'not-the-person' }));
  });
});
