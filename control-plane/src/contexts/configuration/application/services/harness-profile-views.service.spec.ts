import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { HarnessProfileRecord } from '@configuration/application/ports/harness-profile-resources.port';
import type { SecretsAwaitingValuePort } from '@configuration/application/ports/secrets-awaiting-value.port';
import { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const profile = (
  key: string,
  secrets: string[],
  env: Record<string, string> = {},
): HarnessProfileRecord => ({
  id: `profile_${key}`,
  version: 1,
  teamId: TeamId.of('team_1'),
  key: ProfileKey.of(key),
  settings: ProfileSettings.fromRaw({
    permissions: { allow: [], ask: [], deny: [] },
    mcpServers:
      Object.keys(env).length > 0
        ? [{ name: 'linear', command: 'linear-mcp', args: [], env }]
        : [],
    native: {},
    secrets,
  }),
});

const setUp = (awaiting: readonly string[]) => {
  const awaitingValueIn = vi.fn(
    async (_workspace: WorkspaceId, names: readonly SecretName[]) =>
      names.filter((each) => awaiting.includes(each.value)),
  );
  const views = new HarnessProfileViews(
    { find: vi.fn(), inWorkspace: vi.fn() } satisfies TeamDirectoryPort,
    {
      warningsOf: () => [],
    } as unknown as HarnessProfileCompilerPort,
    { awaitingValueIn } satisfies SecretsAwaitingValuePort,
  );

  return { views, awaitingValueIn };
};

const warned = (view: HarnessProfileResourceDto) =>
  view.warnings.map((each) => ({
    at: each.field.rendered,
    reason: each.reason,
    warning: each.isWarning,
  }));

describe('HarnessProfileViews', () => {
  it('warns where a profile names a secret that awaits a value, asking once for the whole workspace', async () => {
    const { views, awaitingValueIn } = setUp([
      'STAGING_VIEWER',
      'LINEAR_API_KEY',
    ]);

    const [staging, linear] = await views.inWorkspace(WORKSPACE, [
      { record: profile('staging', ['STAGING_VIEWER']), teamKey: 'core' },
      {
        record: profile('linear', [], {
          LINEAR_API_KEY: 'secret.LINEAR_API_KEY',
        }),
        teamKey: 'web',
      },
    ]);

    expect(awaitingValueIn).toHaveBeenCalledTimes(1);
    expect(staging && warned(staging)).toEqual([
      {
        at: 'secrets[0]',
        reason:
          'names secret STAGING_VIEWER, which has no value. Runs with this profile do not start until a person sets it',
        warning: true,
      },
    ]);
    expect(linear && warned(linear)).toEqual([
      {
        at: 'mcpServers[0].env.LINEAR_API_KEY',
        reason:
          'names secret LINEAR_API_KEY, which has no value. Runs with this profile do not start until a person sets it',
        warning: true,
      },
    ]);
    expect(linear?.address).toBe('web/linear');
  });

  it('warns of nothing where every secret a profile names has a value', async () => {
    const { views } = setUp([]);

    const [viewed] = await views.inWorkspace(WORKSPACE, [
      { record: profile('staging', ['STAGING_VIEWER']), teamKey: 'core' },
    ]);

    expect(viewed?.warnings).toEqual([]);
    expect(viewed?.secrets).toEqual(['STAGING_VIEWER']);
  });

  it('exports a profile without asking whether its secrets have a value', () => {
    const { views, awaitingValueIn } = setUp(['STAGING_VIEWER']);

    const exported = views.exported(
      profile('staging', ['STAGING_VIEWER']),
      'core',
    );

    expect(exported.warnings).toEqual([]);
    expect(awaitingValueIn).not.toHaveBeenCalled();
  });
});
