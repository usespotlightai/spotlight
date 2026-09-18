import { PinConfigurationHandler } from '@configuration/application/commands/handlers/pin-configuration.handler';
import { PinConfigurationCommand } from '@configuration/application/commands/pin-configuration.command';
import type {
  TeamStanding,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import type { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { ConfigurationHomeMovedOnError } from '@configuration/domain/exceptions/configuration-home-moved-on.error';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const viewed = (administers: boolean): TeamStanding => ({
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  connected: true,
  viewer: UserId.of('user_1'),
  administers,
});

const pinning = (
  over: { allowed?: boolean; member?: boolean; refused?: boolean } = {},
) => {
  const dispatched: DomainEvent[] = [];
  const save = vi.fn(async (home: ConfigurationHome) => {
    dispatched.push(...home.pullEvents());
  });
  const ensure = vi.fn(async (_target: { repository: Repository }) =>
    over.refused ? 'refused' : 'held',
  );
  const homes = { find: async () => null, save };

  return {
    save,
    ensure,
    dispatched,
    handler: new PinConfigurationHandler(
      {
        find: vi.fn(),
        viewedBy: vi.fn(async () =>
          over.member === false ? null : viewed(over.allowed !== false),
        ),
        inWorkspace: vi.fn(),
      } satisfies TeamsPort,
      homes,
      new ConfigurationTarget({} as TeamConfigurationRepository, homes),
      { ensure } as never,
    ),
  };
};

const command = (repository: string | null = 'acme/api') =>
  new PinConfigurationCommand('team_1', repository, 'user_1');

describe('PinConfigurationHandler', () => {
  it('says which repository the team reads from', async () => {
    const { handler, save } = pinning();

    expect(await handler.execute(command())).toBe(true);

    const [saved] = save.mock.calls[0] as [ConfigurationHome];
    expect(saved.keptIn?.value).toBe('acme/api');
  });

  it('says the team chose, so setup can look at whether that was the last step', async () => {
    const { handler, dispatched } = pinning();

    await handler.execute(command());

    expect(dispatched.map((each) => each.kind)).toEqual([
      'configuration.pinned',
    ]);
  });

  it('takes the choice off again', async () => {
    const { handler, save } = pinning();

    expect(await handler.execute(command(null))).toBe(true);

    const [saved] = save.mock.calls[0] as [ConfigurationHome];
    expect(saved.keptIn).toBeNull();
  });

  it('says nothing where the caller may not connect the team’s hosts', async () => {
    const { handler, save } = pinning({ allowed: false });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('says nothing where the caller is not of such a team', async () => {
    const { handler, save } = pinning({ member: false });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses something that is not a repository name', async () => {
    const { handler } = pinning();

    await expect(handler.execute(command('not a repo'))).rejects.toBeInstanceOf(
      UseCaseFault,
    );
  });

  it('asks for the chosen repository to be made ready', async () => {
    const { handler, ensure } = pinning();

    await handler.execute(command());

    const [target] = ensure.mock.calls[0] as [{ repository: Repository }];
    expect(target.repository.value).toBe('acme/api');
  });

  it('refuses to pin a repository GitHub would not make, and keeps the choice as it was', async () => {
    const { handler, save } = pinning({ refused: true });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      UseCaseFault,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('asks for nothing where the choice is taken off', async () => {
    const { handler, ensure } = pinning();

    await handler.execute(command(null));

    expect(ensure).not.toHaveBeenCalled();
  });

  it('refuses with a conflict where the choice changed while it was being made', async () => {
    const { handler, save, dispatched } = pinning();
    save.mockImplementationOnce(async () => {
      throw new ConfigurationHomeMovedOnError('team_1');
    });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(dispatched).toEqual([]);
  });
});
