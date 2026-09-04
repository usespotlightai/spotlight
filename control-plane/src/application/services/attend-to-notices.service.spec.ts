import type { LoggerPort } from '@application/ports/logger.port';
import type { Noticed } from '@application/ports/webhook-source.port';
import { AttendToNotices } from '@application/services/attend-to-notices.service';
import type { ReadConfiguration } from '@application/services/read-configuration.service';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { describe, expect, it, vi } from 'vitest';

const TOUCHED: Noticed = {
  kind: 'configuration-touched',
  repository: 'acme/api',
};

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const attending = (
  reading: readonly { id: { value: string } }[],
  read: () => Promise<unknown> = async () => null,
) => {
  const teams = {
    readingFrom: vi.fn(async () => reading),
  } as unknown as TeamRepository;

  const workspaces = {
    find: vi.fn(async () => ({}) as Workspace),
    withConnection: vi.fn(async () => null),
    save: vi.fn(async () => {}),
  } as unknown as WorkspaceRepository;

  const configuration = { read: vi.fn(read) } as unknown as ReadConfiguration;

  return {
    attend: new AttendToNotices(teams, workspaces, configuration, logger),
    teams,
    workspaces,
    configuration,
  };
};

/** The connection whoever held it can no longer reach anything through. */
const ENDED: Noticed = {
  kind: 'connection-ended',
  source: 'github',
  externalId: '158876513',
};

const holding = (workspace: Workspace | null) => {
  const workspaces = {
    withConnection: vi.fn(async () => (workspace ? { value: 'ws_1' } : null)),
    find: vi.fn(async () => workspace),
    save: vi.fn(async () => {}),
  } as unknown as WorkspaceRepository;

  return {
    attend: new AttendToNotices(
      { readingFrom: vi.fn(async () => []) } as unknown as TeamRepository,
      workspaces,
      { read: vi.fn() } as unknown as ReadConfiguration,
      logger,
    ),
    workspaces,
  };
};

/** A team that reads from that repository, which is what a push finds. */
const team = (id: string) => ({
  id: { value: id },
  workspaceId: { value: 'ws_1' },
});

describe('AttendToNotices', () => {
  it('reads again for whoever reads that repository', async () => {
    const { attend, teams, configuration } = attending([
      team('team_1'),
      team('team_2'),
    ]);

    await attend.attend([TOUCHED]);

    expect(teams.readingFrom).toHaveBeenCalledTimes(1);
    expect(configuration.read).toHaveBeenCalledTimes(2);
  });

  it('reads nothing where nobody reads that repository', async () => {
    const { attend, configuration } = attending([]);

    await attend.attend([TOUCHED]);

    expect(configuration.read).not.toHaveBeenCalled();
  });

  it('attends to nothing where the delivery said nothing of the sort', async () => {
    const { attend, teams } = attending([team('team_1')]);

    await attend.attend([]);

    expect(teams.readingFrom).not.toHaveBeenCalled();
  });

  // A host is not to be told to send its push again because a file in it
  // would not parse. The problems are written down where they can be seen.
  it('does not fail the delivery when reading goes wrong', async () => {
    const { attend, configuration } = attending([team('team_1')], () => {
      throw new Error('GitHub would not answer');
    });

    await expect(attend.attend([TOUCHED])).resolves.toBeUndefined();
    expect(configuration.read).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('refuses to read for a repository named as nothing of the kind', async () => {
    const { attend, configuration } = attending([team('team_1')]);

    await attend.attend([
      { kind: 'configuration-touched', repository: 'not a repository' },
    ]);

    expect(configuration.read).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  // Removed on GitHub is removed here: what a workspace holds for it is a key
  // to a door that is no longer there.
  it('lets go of a connection the host ended', async () => {
    const disconnectedFrom = vi.fn(() => 'let go');
    const { attend, workspaces } = holding({
      disconnectedFrom,
    } as unknown as Workspace);

    await attend.attend([ENDED]);

    expect(workspaces.withConnection).toHaveBeenCalledWith(
      'github',
      '158876513',
    );
    expect(disconnectedFrom).toHaveBeenCalledWith('github');
    expect(workspaces.save).toHaveBeenCalledWith('let go');
  });

  it('saves nothing where nobody held that connection', async () => {
    const { attend, workspaces } = holding(null);

    await attend.attend([ENDED]);

    expect(workspaces.save).not.toHaveBeenCalled();
  });
});
