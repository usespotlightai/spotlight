import { Team } from '@domain/aggregates/team.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { InvalidConfigurationMoveError } from '@domain/exceptions/invalid-configuration-move.error';
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

    // The files already written stay where they were; reading begins anew.
    it('moves to another place once it has somewhere', () => {
      const moved = open()
        .keepsConfigurationIn(Repository.of('acme/api'))
        .keepsConfigurationIn(Repository.of('acme/other'));

      expect(moved.configRepository?.value).toBe('acme/other');
    });

    it('takes the pin off when it is reset to none', () => {
      const reset = open()
        .keepsConfigurationIn(Repository.of('acme/api'))
        .keepsConfigurationIn(null);

      expect(reset.configRepository).toBeNull();
    });

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

  describe('moving its configuration', () => {
    const OLD = Repository.of('acme/old');
    const NEW = Repository.of('acme/new');

    const keeping = () => {
      const kept = open().keepsConfigurationIn(OLD);
      kept.pullEvents();

      return kept;
    };

    it('goes on reading where it does while a move is under way', () => {
      const moving = keeping().movesConfigurationTo(NEW, null);

      expect(moving.configRepository).toEqual(OLD);
      expect(moving.movingConfigurationTo).toEqual(NEW);
      expect(moving.configurationReadFrom(null)).toEqual(OLD);
    });

    it('writes changes to where it is moving', () => {
      expect(
        keeping().movesConfigurationTo(NEW, null).configurationWrittenTo(OLD),
      ).toEqual(NEW);
    });

    it('reads and writes where it keeps its configuration otherwise', () => {
      expect(keeping().configurationReadFrom(NEW)).toEqual(OLD);
      expect(keeping().configurationWrittenTo(NEW)).toEqual(OLD);
    });

    it('reads and writes where it was last found where it keeps it nowhere', () => {
      expect(open().configurationReadFrom(NEW)).toEqual(NEW);
      expect(open().configurationWrittenTo(NEW)).toEqual(NEW);
    });

    it('says a move started, and that it landed', () => {
      const landed = keeping()
        .movesConfigurationTo(NEW, null)
        .finishesMovingConfiguration();

      expect(landed.pullEvents().map((each) => each.kind)).toEqual([
        'team.configuration-move-started',
        'team.configuration-moved',
      ]);
      expect(landed.configRepository).toEqual(NEW);
      expect(landed.movingConfigurationTo).toBeNull();
    });

    it('starts the same move again as nothing new', () => {
      const moving = keeping().movesConfigurationTo(NEW, null);
      moving.pullEvents();

      expect(moving.movesConfigurationTo(NEW, null)).toBe(moving);
    });

    it('refuses to move to where it already reads from', () => {
      expect(() => keeping().movesConfigurationTo(OLD, null)).toThrow(
        InvalidConfigurationMoveError,
      );
      expect(() => open().movesConfigurationTo(NEW, NEW)).toThrow(
        InvalidConfigurationMoveError,
      );
    });

    it('refuses to finish a move nobody started', () => {
      expect(() => keeping().finishesMovingConfiguration()).toThrow(
        InvalidConfigurationMoveError,
      );
    });

    it('gives up a move under way when somebody says where it keeps it', () => {
      const pinned = keeping()
        .movesConfigurationTo(NEW, null)
        .keepsConfigurationIn(Repository.of('acme/other'));

      expect(pinned.configRepository?.value).toBe('acme/other');
      expect(pinned.movingConfigurationTo).toBeNull();
    });

    it('will not be read back moving to where it already keeps it', () => {
      expect(() =>
        Team.rehydrate({
          id: open().id,
          workspaceId: WORKSPACE,
          name: TeamName.of('Platform'),
          members: [{ userId: OWNER, role: 'owner' }],
          configRepository: OLD,
          movingConfigurationTo: OLD,
        }),
      ).toThrow(InconsistentStateError);
    });
  });

  it('is the same team as another holding its identity', () => {
    const held = open();

    expect(held.equals(held.keepsConfigurationIn(null))).toBe(true);
  });
});
