import { ConfigurationTarget } from '@application/services/configuration-target.service';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { describe, expect, it, vi } from 'vitest';

const workspace = (connected = true) =>
  ({
    connectionTo: () => (connected ? Connection.of('github', '42') : null),
  }) as unknown as Workspace;

const team = (pinned: string | null = 'acme/pinned') =>
  ({
    id: { value: 'team_1' },
    configRepository: pinned ? Repository.of(pinned) : null,
  }) as unknown as Team;

const targeting = (appliedRepo: string | null) => {
  const configurations = {
    findFor: vi.fn(async () =>
      appliedRepo ? { repository: Repository.of(appliedRepo) } : null,
    ),
  } as unknown as TeamConfigurationRepository;

  return new ConfigurationTarget(configurations);
};

describe('ConfigurationTarget', () => {
  // The board reflects the repository last read from, so a change is written
  // there rather than to a pin that reading has moved on from.
  it('takes the repository last read from over the pinned one', async () => {
    const into = await targeting('acme/applied').of(workspace(), team());

    expect(into?.repository.value).toBe('acme/applied');
  });

  it('falls back to the pinned repository before anything is read', async () => {
    const into = await targeting(null).of(workspace(), team('acme/pinned'));

    expect(into?.repository.value).toBe('acme/pinned');
  });

  it('is nothing where there is no repository to write to', async () => {
    expect(await targeting(null).of(workspace(), team(null))).toBeNull();
  });

  it('is nothing where the workspace reaches no GitHub', async () => {
    expect(
      await targeting('acme/applied').of(workspace(false), team()),
    ).toBeNull();
  });
});
