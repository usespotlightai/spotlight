import type {
  HarnessProfileRecord,
  HarnessProfileResourcesPort,
} from '@configuration/application/ports/harness-profile-resources.port';
import { ProfileSecretUses } from '@configuration/application/services/profile-secret-uses.service';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const profile = (
  key: string,
  env: Record<string, string>,
): HarnessProfileRecord => ({
  id: `profile_${key}`,
  teamId: TeamId.of('team_core'),
  key: ProfileKey.of(key),
  settings: ProfileSettings.fromRaw({
    permissions: { allow: [], ask: [], deny: [] },
    mcpServers: [{ name: 'linear', command: 'npx', args: [], env }],
    native: {},
  }),
  version: 1,
});

const uses = new ProfileSecretUses(
  {
    inWorkspace: async () => [{ id: TeamId.of('team_core'), key: 'core' }],
  } as unknown as TeamDirectoryPort,
  {
    ofTeam: async () => [
      profile('careful', { LINEAR_API_KEY: 'secret.LINEAR_API_KEY' }),
      profile('plain', { LINEAR_API_KEY: 'LINEAR_API_KEY' }),
    ],
  } as unknown as HarnessProfileResourcesPort,
);

describe('ProfileSecretUses', () => {
  it('names each profile whose MCP servers use the secret', async () => {
    await expect(
      uses.usesOf({ workspaceId: 'ws_1', name: 'LINEAR_API_KEY' }),
    ).resolves.toEqual([{ kind: 'harness-profile', key: 'core/careful' }]);
  });

  it('names none for a secret no profile uses', async () => {
    await expect(
      uses.usesOf({ workspaceId: 'ws_1', name: 'SENTRY_TOKEN' }),
    ).resolves.toEqual([]);
  });
});
