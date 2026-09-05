import { Team } from '@domain/aggregates/team.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import { ConfigurationSettledError } from '@domain/exceptions/configuration-settled.error';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const OWNER = UserId.of('user_1');

const open = (name = 'Platform') => {
  let next = 0;

  return Team.open({
    workspaceId: WORKSPACE,
    name: TeamName.of(name),
    owner: OWNER,
    newId: () => `team_${++next}`,
  });
};

describe('Team', () => {
  it('starts with whoever opened it as its owner', () => {
    expect(open().members).toEqual([{ userId: OWNER, role: 'owner' }]);
  });

  it('belongs to the workspace it was opened in', () => {
    expect(open().workspaceId).toEqual(WORKSPACE);
  });

  // The key is what appears in a repository and in a webhook address, and
  // neither is a place for a generated identifier.
  it('takes a key from its name where nobody wrote one', () => {
    expect(open('Platform Engineering').key.value).toBe('platform-engineering');
    expect(
      Team.open({
        workspaceId: WORKSPACE,
        name: TeamName.of('Platform'),
        key: TeamKey.of('core'),
        owner: OWNER,
        newId: () => 'team_1',
      }).key.value,
    ).toBe('core');
  });

  // A team opened is the team's own news; what follows is somebody else's.
  it('says it was opened', () => {
    const [raised, ...rest] = open().pullEvents();

    expect(rest).toHaveLength(0);
    expect(raised).toBeInstanceOf(TeamCreated);
    expect((raised as TeamCreated).workspaceId).toEqual(WORKSPACE);
  });

  it('says nothing of the sort once it has been read back', () => {
    expect(
      Team.rehydrate({
        id: open().id,
        workspaceId: WORKSPACE,
        name: TeamName.of('Platform'),
        members: [{ userId: OWNER, role: 'owner' }],
      }).pullEvents(),
    ).toEqual([]);
  });

  it('says who is on it', () => {
    expect(open().holds(OWNER)).toBe(true);
    expect(open().holds(UserId.of('stranger'))).toBe(false);
  });

  describe('where it reads its configuration from', () => {
    it('reads from nowhere in particular until somebody says', () => {
      expect(open().configRepository).toBeNull();
    });

    it('takes the repository it is pinned to', () => {
      const pinned = open().keepsConfigurationIn(Repository.of('acme/api'));

      expect(pinned.configRepository?.value).toBe('acme/api');
    });

    // Moving it would leave every file already written behind, and read
    // somebody else's from then on.
    it('refuses to be moved once it has somewhere', () => {
      const pinned = open().keepsConfigurationIn(Repository.of('acme/api'));

      expect(() =>
        pinned.keepsConfigurationIn(Repository.of('acme/other')),
      ).toThrow(ConfigurationSettledError);
    });

    it('refuses to have it taken back', () => {
      const pinned = open().keepsConfigurationIn(Repository.of('acme/api'));

      expect(() => pinned.keepsConfigurationIn(null)).toThrow(
        ConfigurationSettledError,
      );
    });

    // Saying the same place twice is not a change, so it is not a refusal.
    it('takes the same place again as nothing new', () => {
      const pinned = open().keepsConfigurationIn(Repository.of('acme/api'));

      expect(
        pinned.keepsConfigurationIn(Repository.of('acme/api')).configRepository
          ?.value,
      ).toBe('acme/api');
    });

    it('leaves the team it was asked of unchanged', () => {
      const held = open();
      held.keepsConfigurationIn(Repository.of('acme/api'));

      expect(held.configRepository).toBeNull();
    });
  });

  it('is the same team as another holding its identity', () => {
    const held = open();

    expect(held.equals(held.keepsConfigurationIn(null))).toBe(true);
  });
});
