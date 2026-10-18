import type { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import type { ListedServersPort } from '@integrations/application/ports/listed-servers.port';
import { RelistServers } from '@integrations/application/services/relist-servers.service';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEN_MINUTES = 10 * 60_000;

const NOW = new Date('2026-10-05T10:00:00.000Z');

const server = (integration: string) => ({
  teamId: TeamId.of('team_1'),
  integration: IntegrationKey.of(integration),
});

const relisting = (claimed: readonly ReturnType<typeof server>[]) => {
  const claimListedBefore = vi.fn(async () => claimed);
  const execute = vi.fn(async (_command: RefreshIntegrationSpecCommand) => {});
  const log = { error: vi.fn() } as unknown as LoggerPort;
  const servers = new RelistServers(
    { claimListedBefore } as ListedServersPort,
    { execute } as CommandHandlerPort<RefreshIntegrationSpecCommand, void>,
    { now: () => NOW } as ClockPort,
    log,
    TEN_MINUTES,
  );

  return { servers, claimListedBefore, execute, log };
};

describe('RelistServers', () => {
  it('claims the servers listed longer ago than the interval, as of now', async () => {
    const { servers, claimListedBefore } = relisting([]);

    await servers.processDue();

    expect(claimListedBefore).toHaveBeenCalledWith(
      new Date('2026-10-05T09:50:00.000Z'),
      NOW,
    );
  });

  it('lists each server it claimed again', async () => {
    const { servers, execute } = relisting([
      server('tracker'),
      server('notes'),
    ]);

    await servers.processDue();

    expect(execute.mock.calls.map(([command]) => command.integration)).toEqual([
      'tracker',
      'notes',
    ]);
  });

  it('goes on to the next server when one cannot be listed', async () => {
    const { servers, execute, log } = relisting([
      server('tracker'),
      server('notes'),
    ]);
    execute.mockRejectedValueOnce(new Error('moved on'));

    await expect(servers.processDue()).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledOnce();
  });
});
