import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { InvalidConfigurationMoveError } from '@configuration/domain/exceptions/invalid-configuration-move.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const OLD = Repository.of('acme/old');
const NEW = Repository.of('acme/new');

const open = () => ConfigurationHome.unpinned(WORKSPACE, TEAM);

const keeping = () => {
  const kept = open().keptInto(OLD);
  kept.pullEvents();

  return kept;
};

describe('ConfigurationHome', () => {
  describe('where a team reads its configuration from', () => {
    it('reads from nowhere in particular until somebody says', () => {
      expect(open().keptIn).toBeNull();
    });

    it('takes the repository it is pinned to, and says so', () => {
      const pinned = open().keptInto(Repository.of('acme/api'));

      expect(pinned.keptIn?.value).toBe('acme/api');
      expect(pinned.pullEvents().map((each) => each.kind)).toEqual([
        'configuration.pinned',
      ]);
    });

    it('moves to another place once it has somewhere', () => {
      const moved = open()
        .keptInto(Repository.of('acme/api'))
        .keptInto(Repository.of('acme/other'));

      expect(moved.keptIn?.value).toBe('acme/other');
    });

    it('takes the pin off when it is reset to none', () => {
      expect(open().keptInto(OLD).keptInto(null).keptIn).toBeNull();
    });

    it('leaves the home it was asked of unchanged', () => {
      const held = open();
      held.keptInto(OLD);

      expect(held.keptIn).toBeNull();
    });

    it('listens to every repository until it is pinned, then to its own and where it is moving', () => {
      expect(open().listensTo(OLD)).toBe(true);
      expect(keeping().listensTo(OLD)).toBe(true);
      expect(keeping().listensTo(NEW)).toBe(false);
      expect(keeping().movesTo(NEW, null).listensTo(NEW)).toBe(true);
    });
  });

  describe('moving a team’s configuration', () => {
    it('goes on reading where it does while a move is under way', () => {
      const moving = keeping().movesTo(NEW, null);

      expect(moving.keptIn).toEqual(OLD);
      expect(moving.movingTo).toEqual(NEW);
      expect(moving.readFrom(null)).toEqual(OLD);
    });

    it('writes changes to where it is moving', () => {
      expect(keeping().movesTo(NEW, null).writtenTo(OLD)).toEqual(NEW);
    });

    it('reads and writes where it keeps its configuration otherwise', () => {
      expect(keeping().readFrom(NEW)).toEqual(OLD);
      expect(keeping().writtenTo(NEW)).toEqual(OLD);
    });

    it('reads and writes where it was last found where it keeps it nowhere', () => {
      expect(open().readFrom(NEW)).toEqual(NEW);
      expect(open().writtenTo(NEW)).toEqual(NEW);
    });

    it('says a move started, and that it landed', () => {
      const landed = keeping().movesTo(NEW, null).finishesMoving();

      expect(landed.pullEvents().map((each) => each.kind)).toEqual([
        'configuration.move-started',
        'configuration.moved',
      ]);
      expect(landed.keptIn).toEqual(NEW);
      expect(landed.movingTo).toBeNull();
    });

    it('starts the same move again as nothing new', () => {
      const moving = keeping().movesTo(NEW, null);
      moving.pullEvents();

      expect(moving.movesTo(NEW, null)).toBe(moving);
    });

    it('refuses to move to where it already reads from', () => {
      expect(() => keeping().movesTo(OLD, null)).toThrow(
        InvalidConfigurationMoveError,
      );
      expect(() => open().movesTo(NEW, NEW)).toThrow(
        InvalidConfigurationMoveError,
      );
    });

    it('refuses to finish a move nobody started', () => {
      expect(() => keeping().finishesMoving()).toThrow(
        InvalidConfigurationMoveError,
      );
    });

    it('gives up a move under way when somebody says where it keeps it', () => {
      const pinned = keeping()
        .movesTo(NEW, null)
        .keptInto(Repository.of('acme/other'));

      expect(pinned.keptIn?.value).toBe('acme/other');
      expect(pinned.movingTo).toBeNull();
    });

    it('will not be read back moving to where it already keeps it', () => {
      expect(() =>
        ConfigurationHome.rehydrate({
          workspaceId: WORKSPACE,
          teamId: TEAM,
          keptIn: OLD,
          movingTo: OLD,
          version: 1,
        }),
      ).toThrow(InconsistentStateError);
    });
  });

  it('is the same home as another for the same team', () => {
    const held = open();

    expect(held.equals(held.keptInto(OLD))).toBe(true);
  });

  describe('being written over', () => {
    it('is new, at no version, until it is first kept', () => {
      expect(open().version).toBe(0);
      expect(open().isNew).toBe(true);
    });

    it('carries the version it was read at through every change', () => {
      const kept = ConfigurationHome.rehydrate({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        keptIn: OLD,
        movingTo: null,
        version: 3,
      });

      expect(kept.isNew).toBe(false);
      expect(kept.keptInto(NEW).version).toBe(3);
      expect(kept.movesTo(NEW, null).version).toBe(3);
      expect(kept.movesTo(NEW, null).finishesMoving().version).toBe(3);
    });

    it('will not be read back as never written', () => {
      expect(() =>
        ConfigurationHome.rehydrate({
          workspaceId: WORKSPACE,
          teamId: TEAM,
          keptIn: OLD,
          movingTo: null,
          version: 0,
        }),
      ).toThrow(InconsistentStateError);
    });
  });
});
