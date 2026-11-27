import { WorkspaceSecrets } from '@configuration/infrastructure/acl/workspace-secrets.adapter';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { DefinedSecretsPort } from '@secrets/application/ports/defined-secrets.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const setUp = (team: boolean) => {
  const namesIn = vi.fn(() =>
    Promise.resolve(['GRAFANA_TOKEN', 'LINEAR_API_KEY']),
  );
  const sandboxSecrets = vi.fn(() => Promise.resolve(['GRAFANA_TOKEN']));

  return {
    namesIn,
    secrets: new WorkspaceSecrets(
      {
        find: vi.fn(() =>
          Promise.resolve(
            team
              ? {
                  id: TEAM,
                  workspaceId: WorkspaceId.of('ws_1'),
                  key: 'core',
                  name: 'Core',
                  members: [],
                }
              : null,
          ),
        ),
        inWorkspace: vi.fn(),
      } satisfies TeamDirectoryPort,
      { namesIn, sandboxSecrets } satisfies DefinedSecretsPort,
    ),
  };
};

describe('WorkspaceSecrets', () => {
  it('names for a team every secret its workspace defines', async () => {
    const { secrets, namesIn } = setUp(true);

    expect((await secrets.ofTeam(TEAM)).map((each) => each.value)).toEqual([
      'GRAFANA_TOKEN',
      'LINEAR_API_KEY',
    ]);
    expect(namesIn).toHaveBeenCalledWith('ws_1');
  });

  it('knows which of those secrets may enter a sandbox', async () => {
    const { secrets } = setUp(true);
    const known = await secrets.known(TEAM);

    expect(known.existing.map((each) => each.value)).toEqual([
      'GRAFANA_TOKEN',
      'LINEAR_API_KEY',
    ]);
    expect(known.sandboxSecrets.map((each) => each.value)).toEqual([
      'GRAFANA_TOKEN',
    ]);
  });

  it('names nothing for a team that no workspace has', async () => {
    const { secrets, namesIn } = setUp(false);

    await expect(secrets.ofTeam(TEAM)).resolves.toEqual([]);
    expect((await secrets.known(TEAM)).existing).toEqual([]);
    expect(namesIn).not.toHaveBeenCalled();
  });
});
