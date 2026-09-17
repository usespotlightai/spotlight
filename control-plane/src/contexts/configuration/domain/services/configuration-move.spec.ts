import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import { ConfigurationMoveStarted } from '@configuration/domain/events/configuration-move-started.event';
import { ConfigurationMoved } from '@configuration/domain/events/configuration-moved.event';
import { InvalidConfigurationMoveError } from '@configuration/domain/exceptions/invalid-configuration-move.error';
import {
  landConfigurationMove,
  moveConfiguration,
} from '@configuration/domain/services/configuration-move';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const OLD = Repository.of('acme/old');
const NEW = Repository.of('acme/new');

const LINE = ConfigurationFile.of(
  '.spotlight/lines/delivery/line.yml',
  'version: 1',
);

const home = (kept: Repository | null = OLD) =>
  ConfigurationHome.rehydrate({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    keptIn: kept,
    movingTo: null,
    version: 1,
  });

const reading = (
  files: readonly ConfigurationFile[] = [LINE],
  repository = OLD,
) =>
  TeamConfiguration.rehydrate({
    problems: [],
    integrations: [],
    teamId: TeamId.of('team_1'),
    repository,
    commit: Commit.of('a1b2c3d'),
    files,
    begunAt: new Date('2026-09-10T08:00:00.000Z'),
    readAt: new Date('2026-09-10T08:00:00.000Z'),
  });

const moving = (
  over: {
    home?: ConfigurationHome;
    current?: TeamConfiguration | null;
    destination?: Repository;
    destinationHolds?: boolean;
  } = {},
) =>
  moveConfiguration({
    home: over.home ?? home(),
    current: over.current === undefined ? reading() : over.current,
    destination: over.destination ?? NEW,
    destinationHolds: over.destinationHolds ?? false,
  });

describe('moveConfiguration', () => {
  describe('carrying what it runs on today', () => {
    it('carries the files it kept at its last reading', () => {
      const move = moving();

      expect(move.kind).toBe('carried');
      expect(
        move.kind === 'carried' && move.files.map((each) => each.path),
      ).toEqual([LINE.path]);
    });

    it('carries every file it read', () => {
      const move = moving({ current: reading([LINE]) });

      expect(
        move.kind === 'carried' && move.files.map((each) => each.path),
      ).toEqual([LINE.path]);
    });

    it('goes on reading where it did until the move lands', () => {
      const { home: moved } = moving();

      expect(moved.keptIn).toEqual(OLD);
      expect(moved.movingTo).toEqual(NEW);
    });

    it('says the move started', () => {
      const [started, ...rest] = moving().home.pullEvents();

      expect(rest).toHaveLength(0);
      expect(started).toBeInstanceOf(ConfigurationMoveStarted);
      expect((started as ConfigurationMoveStarted).to).toEqual(NEW);
    });

    it('starts the same move again as nothing new', () => {
      const first = moving().home;
      first.pullEvents();

      const again = moving({ home: first });

      expect(again.kind).toBe('carried');
      expect(again.home.pullEvents()).toEqual([]);
    });
  });

  it('adopts a destination that already holds configuration', () => {
    const move = moving({ destinationHolds: true });

    expect(move.kind).toBe('adopted');
    expect(move.home.keptIn).toEqual(NEW);
    expect(move.home.movingTo).toBeNull();

    const events = move.home.pullEvents();
    const moved = events[events.length - 1] as ConfigurationMoved;
    expect(moved).toBeInstanceOf(ConfigurationMoved);
    expect(moved.from).toEqual(OLD);
    expect(moved.to).toEqual(NEW);
  });

  it('reads from the destination at once where there is nothing to carry', () => {
    const move = moving({ current: null });

    expect(move.kind).toBe('repointed');
    expect(move.home.keptIn).toEqual(NEW);
    expect(move.home.movingTo).toBeNull();
  });

  it('refuses to move to where it already reads from', () => {
    expect(() => moving({ destination: OLD })).toThrow(
      InvalidConfigurationMoveError,
    );
  });

  it('refuses to move to where the fallback rule already reads it from', () => {
    expect(() =>
      moving({ home: home(null), current: reading([LINE], NEW) }),
    ).toThrow(InvalidConfigurationMoveError);
  });
});

describe('landConfigurationMove', () => {
  const underWay = () => {
    const moved = moving().home;
    moved.pullEvents();

    return moved;
  };

  it('lands once the destination holds configuration of its own', () => {
    const landed = landConfigurationMove(underWay(), true);

    expect(landed.keptIn).toEqual(NEW);
    expect(landed.movingTo).toBeNull();
    expect(landed.pullEvents()).toEqual([expect.any(ConfigurationMoved)]);
  });

  it('gives the home back as it was until then', () => {
    const moving = underWay();

    expect(landConfigurationMove(moving, false)).toBe(moving);
  });

  it('leaves a home with nothing moving alone', () => {
    const still = home();

    expect(landConfigurationMove(still, true)).toBe(still);
  });
});
