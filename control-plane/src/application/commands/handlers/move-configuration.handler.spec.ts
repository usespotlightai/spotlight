import { MoveConfigurationHandler } from '@application/commands/handlers/move-configuration.handler';
import { MoveConfigurationCommand } from '@application/commands/move-configuration.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import { ConfigurationTarget } from '@application/services/configuration-target.service';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { HeldConfiguration } from '@application/services/held-configuration.service';
import type {
  Provisioned,
  RepositoryProvisioning,
} from '@application/services/repository-provisioning.service';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import { Team } from '@domain/aggregates/team.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { ConfigurationMoveStarted } from '@domain/events/configuration-move-started.event';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Connection } from '@domain/value-objects/connection.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [{ userId: UserId.of('user_1'), role: 'owner' }],
  configRepository: Repository.of('acme/old'),
});

const LINE = { path: '.spotlight/lines/delivery.yml', text: 'a: b' };

const acme = (connected = true) =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: UserId.of('user_1'), role: 'owner' }],
    teams: [TEAM.id],
    connections: connected ? [Connection.of('github', '158883204')] : [],
  });

const current = () =>
  TeamConfiguration.read({
    teamId: TEAM.id,
    repository: Repository.of('acme/old'),
    commit: Commit.of('a1b2c3d'),
    files: [ConfigurationFile.of(LINE.path, LINE.text)],
    readAt: new Date('2026-09-10T08:00:00.000Z'),
  });

const moving = (
  over: {
    allowed?: boolean;
    team?: null;
    connected?: boolean;
    provisioned?: Provisioned;
    /** What the destination already holds, or null where it has no branch. */
    destination?: { path: string; text: string }[] | null;
    current?: null;
  } = {},
) => {
  const save = vi.fn(async (_team: Team) => {});
  const settling = vi.fn(async () => {});
  const dispatch = vi.fn(async (_events: readonly unknown[]) => {});
  const ensure = vi.fn(async () => over.provisioned ?? 'held');
  const writeInto = vi.fn(async () => ({
    url: 'https://github.com/acme/config/pull/4',
  }));
  const held = over.destination === undefined ? [] : over.destination;

  return {
    save,
    settling,
    dispatch,
    writeInto,
    handler: new MoveConfigurationHandler(
      {
        connectableBy: vi.fn(async () =>
          over.allowed === false ? null : acme(over.connected),
        ),
      } as unknown as ConnectionAuthorization,
      {
        find: vi.fn(async () => (over.team === null ? null : TEAM)),
        save,
      } as unknown as TeamRepository,
      {
        findFor: vi.fn(async () => (over.current === null ? null : current())),
      } as unknown as TeamConfigurationRepository,
      new ConfigurationTarget({} as TeamConfigurationRepository),
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
      { forTeam: settling } as never,
      { dispatch } as unknown as DomainEventDispatcher,
    ),
  };
};

const command = (repository = 'acme/config') =>
  new MoveConfigurationCommand('team_1', repository, 'user_1');

const savedTeam = (save: ReturnType<typeof moving>['save']) =>
  save.mock.calls[0]?.[0] as Team;

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

      expect(savedTeam(save).configRepository?.value).toBe('acme/old');
      expect(savedTeam(save).movingConfigurationTo?.value).toBe('acme/config');
    });

    it('says the move started', async () => {
      const { handler, dispatch } = moving();

      await handler.execute(command());

      expect(dispatch).toHaveBeenCalledWith([
        expect.any(ConfigurationMoveStarted),
      ]);
    });

    it('looks at whether that was the last step', async () => {
      const { handler, settling } = moving();

      await handler.execute(command());

      expect(settling).toHaveBeenCalled();
    });
  });

  it('adopts a repository that already holds configuration, writing nothing over it', async () => {
    const { handler, save, writeInto } = moving({ destination: [LINE] });

    expect(await handler.execute(command())).toEqual({ kind: 'adopted' });
    expect(writeInto).not.toHaveBeenCalled();
    expect(savedTeam(save).configRepository?.value).toBe('acme/config');
  });

  it('reads from the new repository at once where there is nothing to carry', async () => {
    const { handler, save, writeInto } = moving({ current: null });

    expect(await handler.execute(command())).toEqual({ kind: 'repointed' });
    expect(writeInto).not.toHaveBeenCalled();
    expect(savedTeam(save).configRepository?.value).toBe('acme/config');
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
});
