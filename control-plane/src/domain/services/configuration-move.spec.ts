import { Team } from '@domain/aggregates/team.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { ConfigurationMoveStarted } from '@domain/events/configuration-move-started.event';
import { ConfigurationMoved } from '@domain/events/configuration-moved.event';
import { InvalidConfigurationMoveError } from '@domain/exceptions/invalid-configuration-move.error';
import {
  landConfigurationMove,
  moveConfiguration,
} from '@domain/services/configuration-move';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const OLD = Repository.of('acme/old');
const NEW = Repository.of('acme/new');

const LINE = ConfigurationFile.of(
  '.spotlight/lines/delivery/line.yml',
  'version: 1',
);

const team = (kept: Repository | null = OLD) =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TeamKey.of('platform'),
    name: TeamName.of('Platform'),
    members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
    configRepository: kept,
  });

const reading = (
  files: readonly ConfigurationFile[] = [LINE],
  repository = OLD,
) =>
  TeamConfiguration.read({
    teamId: TeamId.of('team_1'),
    repository,
    commit: Commit.of('a1b2c3d'),
    files,
    readAt: new Date('2026-09-10T08:00:00.000Z'),
  });

const moving = (
  over: {
    team?: Team;
    current?: TeamConfiguration | null;
    destination?: Repository;
    destinationHolds?: boolean;
  } = {},
) =>
  moveConfiguration({
    team: over.team ?? team(),
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

    it('carries only what is Spotlight’s to read', () => {
      const move = moving({
        current: reading([LINE, ConfigurationFile.of('README.md', '# Acme')]),
      });

      expect(
        move.kind === 'carried' && move.files.map((each) => each.path),
      ).toEqual([LINE.path]);
    });

    it('goes on reading where it did until the move lands', () => {
      const { team: moved } = moving();

      expect(moved.configRepository).toEqual(OLD);
      expect(moved.movingConfigurationTo).toEqual(NEW);
    });

    it('says the move started', () => {
      const [started, ...rest] = moving().team.pullEvents();

      expect(rest).toHaveLength(0);
      expect(started).toBeInstanceOf(ConfigurationMoveStarted);
      expect((started as ConfigurationMoveStarted).to).toEqual(NEW);
    });

    it('starts the same move again as nothing new', () => {
      const first = moving().team;
      first.pullEvents();

      const again = moving({ team: first });

      expect(again.kind).toBe('carried');
      expect(again.team.pullEvents()).toEqual([]);
    });
  });

  it('adopts a destination that already holds configuration', () => {
    const move = moving({ destinationHolds: true });

    expect(move.kind).toBe('adopted');
    expect(move.team.configRepository).toEqual(NEW);
    expect(move.team.movingConfigurationTo).toBeNull();

    const events = move.team.pullEvents();
    const moved = events[events.length - 1] as ConfigurationMoved;
    expect(moved).toBeInstanceOf(ConfigurationMoved);
    expect(moved.from).toEqual(OLD);
    expect(moved.to).toEqual(NEW);
  });

  it('reads from the destination at once where there is nothing to carry', () => {
    const move = moving({ current: null });

    expect(move.kind).toBe('repointed');
    expect(move.team.configRepository).toEqual(NEW);
    expect(move.team.movingConfigurationTo).toBeNull();
  });

  it('refuses to move to where it already reads from', () => {
    expect(() => moving({ destination: OLD })).toThrow(
      InvalidConfigurationMoveError,
    );
  });

  it('refuses to move to where the fallback rule already reads it from', () => {
    expect(() =>
      moving({ team: team(null), current: reading([LINE], NEW) }),
    ).toThrow(InvalidConfigurationMoveError);
  });
});

describe('landConfigurationMove', () => {
  const underWay = () => {
    const moved = moving().team;
    moved.pullEvents();

    return moved;
  };

  it('lands once the destination holds configuration of its own', () => {
    const landed = landConfigurationMove(underWay(), true);

    expect(landed.configRepository).toEqual(NEW);
    expect(landed.movingConfigurationTo).toBeNull();
    expect(landed.pullEvents()).toEqual([expect.any(ConfigurationMoved)]);
  });

  it('gives the team back as it was until then', () => {
    const moving = underWay();

    expect(landConfigurationMove(moving, false)).toBe(moving);
  });

  it('leaves a team with nothing moving alone', () => {
    const still = team();

    expect(landConfigurationMove(still, true)).toBe(still);
  });
});
