import { MoveConfigurationHandler } from '@configuration/application/commands/handlers/move-configuration.handler';
import { MoveConfigurationCommand } from '@configuration/application/commands/move-configuration.command';
import type {
  TeamStanding,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import type { HeldConfiguration } from '@configuration/application/services/held-configuration.service';
import type {
  Provisioned,
  RepositoryProvisioning,
} from '@configuration/application/services/repository-provisioning.service';
import type { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import { ConfigurationMoveStarted } from '@configuration/domain/events/configuration-move-started.event';
import { ConfigurationHomeMovedOnError } from '@configuration/domain/exceptions/configuration-home-moved-on.error';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const WORKSPACE = WorkspaceId.of('ws_1');

const LINE = { path: '.spotlight/lines/delivery/line.yml', text: 'a: b' };

const viewed = (
  over: { administers?: boolean; connected?: boolean } = {},
): TeamStanding => ({
  teamId: TEAM,
  workspaceId: WORKSPACE,
  connected: over.connected !== false,
  viewer: UserId.of('user_1'),
  administers: over.administers ?? true,
});

const current = () =>
  TeamConfiguration.rehydrate({
    problems: [],
    integrations: [],
    teamId: TEAM,
    repository: Repository.of('acme/old'),
    commit: Commit.of('a1b2c3d'),
    files: [ConfigurationFile.of(LINE.path, LINE.text)],
    begunAt: new Date('2026-09-10T08:00:00.000Z'),
    readAt: new Date('2026-09-10T08:00:00.000Z'),
  });

const moving = (
  over: {
    allowed?: boolean;
    team?: null;
    connected?: boolean;
    provisioned?: Provisioned;
    destination?: { path: string; text: string }[] | null;
    current?: null;
  } = {},
) => {
  const dispatch = vi.fn(async (_events: readonly unknown[]) => {});
  const save = vi.fn(async (home: ConfigurationHome) => {
    await dispatch(home.pullEvents());
  });
  const ensure = vi.fn(async () => over.provisioned ?? 'held');
  const writeInto = vi.fn(async () => ({
    url: 'https://github.com/acme/config/pull/4',
  }));
  const held = over.destination === undefined ? [] : over.destination;

  const homes = {
    find: async () =>
      ConfigurationHome.rehydrate({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        keptIn: Repository.of('acme/old'),
        movingTo: null,
        version: 1,
      }),
    save,
  };

  return {
    save,
    dispatch,
    writeInto,
    handler: new MoveConfigurationHandler(
      {
        find: vi.fn(),
        viewedBy: vi.fn(async () =>
          over.team === null
            ? null
            : viewed({
                administers: over.allowed !== false,
                connected: over.connected,
              }),
        ),
        inWorkspace: vi.fn(),
      } satisfies TeamsPort,
      homes,
      {
        findFor: vi.fn(async () => (over.current === null ? null : current())),
      } as unknown as TeamConfigurationRepository,
      new ConfigurationTarget({} as TeamConfigurationRepository, homes),
      { ensure } as unknown as RepositoryProvisioning,
      {
        at: vi.fn(async ({ repository }: { repository: Repository }) =>
          held === null
            ? null
            : {
                repository,
                sha: 'f00dfeed',
                files: held.map((each) =>
                  ConfigurationFile.of(each.path, each.text),
                ),
              },
        ),
      } as unknown as HeldConfiguration,
      { writeInto } as unknown as WriteConfiguration,
    ),
  };
};

const command = (repository = 'acme/config') =>
  new MoveConfigurationCommand('team_1', repository, 'user_1');

const savedHome = (save: ReturnType<typeof moving>['save']) =>
  save.mock.calls[0]?.[0] as ConfigurationHome;

describe('MoveConfigurationHandler', () => {
  describe('carrying the configuration across', () => {
    it('opens a pull request in the new repository with what it runs on today', async () => {
      const { handler, writeInto } = moving();

      expect(await handler.execute(command())).toEqual({
        kind: 'carried',
        pullRequest: { url: 'https://github.com/acme/config/pull/4' },
      });

      const [into, writing] = writeInto.mock.calls[0] as never as [
        { repository: Repository },
        { files: ConfigurationFile[] },
      ];
      expect(into.repository.value).toBe('acme/config');
      expect(writing.files.map((each) => each.path)).toEqual([LINE.path]);
    });

    it('goes on reading where it does until that pull request merges', async () => {
      const { handler, save } = moving();

      await handler.execute(command());

      expect(savedHome(save).keptIn?.value).toBe('acme/old');
      expect(savedHome(save).movingTo?.value).toBe('acme/config');
    });

    it('says the move started', async () => {
      const { handler, dispatch } = moving();

      await handler.execute(command());

      expect(dispatch).toHaveBeenCalledWith([
        expect.any(ConfigurationMoveStarted),
      ]);
    });
  });

  it('adopts a repository that already holds configuration, writing nothing over it', async () => {
    const { handler, save, writeInto } = moving({ destination: [LINE] });

    expect(await handler.execute(command())).toEqual({ kind: 'adopted' });
    expect(writeInto).not.toHaveBeenCalled();
    expect(savedHome(save).keptIn?.value).toBe('acme/config');
  });

  it('reads from the new repository at once where there is nothing to carry', async () => {
    const { handler, save, writeInto } = moving({ current: null });

    expect(await handler.execute(command())).toEqual({ kind: 'repointed' });
    expect(writeInto).not.toHaveBeenCalled();
    expect(savedHome(save).keptIn?.value).toBe('acme/config');
  });

  describe('refusing a move that cannot reach its destination', () => {
    it('refuses where the workspace reaches no GitHub', async () => {
      const { handler, save } = moving({ connected: false });

      await expect(handler.execute(command())).rejects.toBeInstanceOf(
        UseCaseFault,
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('refuses, leaving nothing behind, where GitHub would not make it', async () => {
      const { handler, save, writeInto } = moving({ provisioned: 'refused' });

      await expect(handler.execute(command())).rejects.toBeInstanceOf(
        UseCaseFault,
      );
      expect(writeInto).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('refuses where the repository has no branch to write against', async () => {
      const { handler, save } = moving({ destination: null });

      await expect(handler.execute(command())).rejects.toBeInstanceOf(
        UseCaseFault,
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('refuses to move to where it already reads from', async () => {
      const { handler, save } = moving();

      await expect(handler.execute(command('acme/old'))).rejects.toBeInstanceOf(
        UseCaseFault,
      );
      expect(save).not.toHaveBeenCalled();
    });
  });

  it('says nothing where the caller may not move the team', async () => {
    const { handler, save } = moving({ allowed: false });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('says nothing where there is no such team', async () => {
    const { handler, save } = moving({ team: null });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses with a conflict where the home changed while the pull request was opened', async () => {
    const { handler, save, dispatch, writeInto } = moving();
    save.mockImplementationOnce(async () => {
      throw new ConfigurationHomeMovedOnError('team_1');
    });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(writeInto).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
