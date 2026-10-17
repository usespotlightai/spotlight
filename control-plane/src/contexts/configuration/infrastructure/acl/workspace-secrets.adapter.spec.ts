import { WorkspaceSecrets } from '@configuration/infrastructure/acl/workspace-secrets.adapter';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { DefinedSecretsPort } from '@secrets/application/ports/defined-secrets.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const setUp = (team: boolean) => {
  const namesIn = vi.fn(async () => ['GRAFANA_TOKEN', 'LINEAR_API_KEY']);

  return {
    namesIn,
    secrets: new WorkspaceSecrets(
      {
        find: vi.fn(async () =>
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
        inWorkspace: vi.fn(),
      } satisfies TeamDirectoryPort,
      { namesIn } satisfies DefinedSecretsPort,
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

  it('names nothing for a team that no workspace has', async () => {
    const { secrets, namesIn } = setUp(false);

    await expect(secrets.ofTeam(TEAM)).resolves.toEqual([]);
    expect(namesIn).not.toHaveBeenCalled();
  });
});
