import type {
  HarnessProfileRecord,
  HarnessProfileResourcesPort,
} from '@configuration/application/ports/harness-profile-resources.port';
import type {
  HookConfig,
  HookConfigsPort,
} from '@configuration/application/ports/hook-configs.port';
import type { IntegrationConfigsPort } from '@configuration/application/ports/integration-configs.port';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import { ResourceConfigurationHandler } from '@configuration/application/queries/handlers/resource-configuration.handler';
import { WorkspaceConfigurationHandler } from '@configuration/application/queries/handlers/workspace-configuration.handler';
import { ResourceConfigurationQuery } from '@configuration/application/queries/resource-configuration.query';
import { WorkspaceConfigurationQuery } from '@configuration/application/queries/workspace-configuration.query';
import { ExportableConfigurations } from '@configuration/application/services/exportable-configurations.service';
import type { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
import type { TokenTrustConfigurationPort } from '@identity/application/ports/token-trust-configuration.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { RunnerConfigurationPort } from '@runners/application/ports/runner-configuration.port';
import type { SecretConfigurationPort } from '@secrets/application/ports/secret-configuration.port';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type {
  LineRecord,
  LineResourcesPort,
} from '@work/application/ports/line-resources.port';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const READ_TOKEN = TokenPrincipal.of({
  tokenId: WorkspaceTokenId.of('token_1'),
  workspaceId: WORKSPACE,
  scopes: TokenScopes.named(['read']),
  issuedBy: UserId.of('user_1'),
});

const teamOf = (id: string, key: string): TeamProfile => ({
  id: TeamId.of(id),
  workspaceId: WORKSPACE,
  key,
  name: key.toUpperCase(),
  members: [],
});

const CORE = teamOf('team_core', 'core');

const OPS = teamOf('team_ops', 'ops');

const secretOf = (id: string, name: string) => ({
  id,
  address: name,
  workspaceId: WORKSPACE,
  name,
  source: { kind: 'built-in', secretId: null, field: null },
  bindings: [],
  storesValue: true,
  valueVersion: 1,
});

const TRUST = {
  id: 'trust_1',
  address: 'cluster',
  workspaceId: WORKSPACE,
  key: 'cluster',
  issuer: 'https://issuer.example',
  subject: 'runner',
  audience: 'spotlight',
  labels: [],
};

const TOKEN_TRUST = {
  id: 'token_trust_1',
  address: 'github-main',
  workspaceId: WORKSPACE,
  key: 'github-main',
  issuer: 'https://token.actions.githubusercontent.com',
  audience: 'spotlight',
  subject: 'repo:acme/platform:ref:refs/heads/main',
  claims: { repository: 'acme/platform' },
  scopes: ['configure'],
  lifetimeMinutes: 15,
};

const POOL = {
  id: 'pool_1',
  address: 'burst',
  workspaceId: WORKSPACE,
  key: 'burst',
  labels: ['gpu'],
  maxRuns: 4,
  tokenVersion: 1,
  provision: null,
};

const DECLARED = {
  id: 'declared_1',
  address: 'acme',
  workspaceId: WORKSPACE,
  trusts: ['cluster'],
  pools: ['burst'],
};

const handlers = (over: { permitted?: boolean } = {}) => {
  const access = {
    permissionsIn: vi.fn(async () =>
      over.permitted === false
        ? null
        : {
            workspaceId: WORKSPACE,
            slug: 'acme',
            configures: false,
            managesSecrets: false,
            managesRunners: false,
            managesTokenTrusts: false,
            isAdmin: false,
          },
    ),
  } as unknown as WorkspaceAccessPort;
  const workspaces = {
    profileOf: vi.fn(async () => ({
      id: WORKSPACE.value,
      name: 'Acme',
      slug: 'acme',
    })),
  } as unknown as WorkspaceReaderPort;
  const teams = {
    find: vi.fn(
      async (id: TeamId) =>
        [OPS, CORE].find((each) => each.id.equals(id)) ?? null,
    ),
    inWorkspace: vi.fn(async () => [OPS, CORE]),
  } satisfies TeamDirectoryPort;
  const integrationOf = (
    id: string,
    team: TeamProfile,
    integration: string,
    definition: Readonly<Record<string, unknown>> = {},
  ) => ({
    id,
    address: `${team.key}/${integration}`,
    teamId: team.id,
    integration,
    definition,
    secretReferences: [],
  });
  const lineOf = (teamId: TeamId, key: string): LineRecord => ({
    id: `line_${key}`,
    version: 1,
    teamId,
    key,
    definition: {
      key,
      name: key,
      repositories: [],
      stations: [],
      reactions: [],
    },
  });
  const lines = {
    withId: vi.fn(async (id: string) =>
      id === 'line_delivery' ? lineOf(CORE.id, 'delivery') : null,
    ),
    at: vi.fn(async () => null),
    ofTeam: vi.fn(async (teamId: TeamId) =>
      teamId.equals(CORE.id)
        ? [lineOf(teamId, 'triage'), lineOf(teamId, 'delivery')]
        : [],
    ),
    ofTeams: vi.fn(async (teamIds: readonly TeamId[]) =>
      teamIds.some((each) => each.equals(CORE.id))
        ? [lineOf(CORE.id, 'triage'), lineOf(CORE.id, 'delivery')]
        : [],
    ),
  } satisfies LineResourcesPort;
  const skills = {
    withId: vi.fn(async () => null),
    at: vi.fn(async () => null),
    ofTeam: vi.fn(async (teamId: TeamId) =>
      teamId.equals(OPS.id)
        ? [
            {
              id: 'skill_1',
              version: 1,
              teamId,
              key: 'grafana',
              files: { 'SKILL.md': 'x' },
            },
          ]
        : [],
    ),
  } satisfies SkillResourcesPort;
  const integrations = {
    withId: vi.fn(async (id: string) =>
      id === 'integration_linear'
        ? integrationOf(id, OPS, 'linear', { integration: 'linear' })
        : null,
    ),
    ofTeam: vi.fn(async (teamId: TeamId) =>
      teamId.equals(CORE.id)
        ? [
            integrationOf('integration_slack', CORE, 'slack'),
            integrationOf('integration_linear_core', CORE, 'linear'),
          ]
        : teamId.equals(OPS.id)
          ? [
              integrationOf('integration_linear', OPS, 'linear', {
                integration: 'linear',
              }),
            ]
          : [],
    ),
  } satisfies IntegrationConfigsPort;
  const hookOf = (id: string, team: TeamProfile, key: string): HookConfig => ({
    id,
    address: `${team.key}/${key}`,
    teamId: team.id,
    key,
    on: 'tool.used',
    match: { tools: [], lines: [], stations: [], repositories: [], paths: [] },
    when: null,
    vars: {},
    steps: [],
    signing: null,
    failure: 'continue',
    timeoutSeconds: 10,
  });
  const hooks = {
    withId: vi.fn(async (id: string) =>
      id === 'hook_audit' ? hookOf(id, CORE, 'audit') : null,
    ),
    ofTeam: vi.fn(async (teamId: TeamId) =>
      teamId.equals(CORE.id) ? [hookOf('hook_audit', CORE, 'audit')] : [],
    ),
  } satisfies HookConfigsPort;
  const profileOf = (id: string, key: string): HarnessProfileRecord => ({
    id,
    version: 1,
    teamId: CORE.id,
    definition: { key },
  });
  const profiles = {
    withId: vi.fn(async (id: string) =>
      id === 'profile_careful' ? profileOf(id, 'careful') : null,
    ),
    at: vi.fn(async () => null),
    ofTeam: vi.fn(async (teamId: TeamId) =>
      teamId.equals(CORE.id)
        ? [
            profileOf('profile_quick', 'quick'),
            profileOf('profile_careful', 'careful'),
          ]
        : [],
    ),
  } satisfies HarnessProfileResourcesPort;
  const profileViews = {
    onTeam: vi.fn((record: HarnessProfileRecord, teamKey: string) => ({
      id: record.id,
      version: record.version,
      address: `${teamKey}/${String(record.definition.key)}`,
      teamId: record.teamId.value,
      key: String(record.definition.key),
      permissions: { allow: [], ask: [], deny: [] },
      mcpServers: [],
      native: {},
      secretReferences: [],
      warnings: [],
    })),
  } as unknown as HarnessProfileViews;
  const secrets = {
    in: vi.fn(async () => [
      secretOf('secret_2', 'SLACK_TOKEN'),
      secretOf('secret_1', 'LINEAR_API_KEY'),
    ]),
    withId: vi.fn(async (id: string) =>
      id === 'secret_1' ? secretOf('secret_1', 'LINEAR_API_KEY') : null,
    ),
  } satisfies SecretConfigurationPort;
  const runners = {
    in: vi.fn(async () => ({
      trusts: [TRUST],
      pools: [POOL],
      egresses: [],
      declared: DECLARED,
    })),
    trustWithId: vi.fn(async (id: string) => (id === TRUST.id ? TRUST : null)),
    poolWithId: vi.fn(async (id: string) => (id === POOL.id ? POOL : null)),
    egressWithId: vi.fn(async () => null),
    declaredWithId: vi.fn(async (id: string) =>
      id === DECLARED.id ? DECLARED : null,
    ),
  } satisfies RunnerConfigurationPort;
  const tokenTrusts = {
    in: vi.fn(async () => [TOKEN_TRUST]),
    withId: vi.fn(async (id: string) =>
      id === TOKEN_TRUST.id ? TOKEN_TRUST : null,
    ),
  } satisfies TokenTrustConfigurationPort;
  const configurations = new ExportableConfigurations(
    teams,
    lines,
    skills,
    integrations,
    hooks,
    profiles,
    profileViews,
    secrets,
    runners,
    tokenTrusts,
  );

  return {
    access,
    workspace: new WorkspaceConfigurationHandler(
      access,
      workspaces,
      configurations,
    ),
    resource: new ResourceConfigurationHandler(
      access,
      workspaces,
      teams,
      lines,
      skills,
      integrations,
      hooks,
      profiles,
      secrets,
      runners,
      tokenTrusts,
      configurations,
    ),
  };
};

describe('WorkspaceConfigurationHandler', () => {
  const exported = (over: Parameters<typeof handlers>[0] = {}) =>
    handlers(over).workspace.execute(
      new WorkspaceConfigurationQuery(WORKSPACE.value, READ_TOKEN),
    );

  it('contains the workspace, what it has itself, and each team with what it has', async () => {
    const configuration = await exported();

    expect(configuration?.workspaceId).toBe('ws_1');
    expect(configuration?.workspaceSlug).toBe('acme');
    expect(
      configuration?.resources
        .map((each) => `${each.kind} ${each.address}`)
        .sort(),
    ).toEqual(
      [
        'workspace acme',
        'secret LINEAR_API_KEY',
        'secret SLACK_TOKEN',
        'workspace-token-trust github-main',
        'runner-trust cluster',
        'runner-pool burst',
        'workspace-runners acme',
        'team core',
        'line core/delivery',
        'line core/triage',
        'integration core/linear',
        'integration core/slack',
        'hook core/audit',
        'harness-profile core/careful',
        'harness-profile core/quick',
        'team ops',
        'skill ops/grafana',
        'integration ops/linear',
      ].sort(),
    );
  });

  it('lets a token that may only read export', async () => {
    const { access, workspace } = handlers();

    expect(
      await workspace.execute(
        new WorkspaceConfigurationQuery(WORKSPACE.value, READ_TOKEN),
      ),
    ).not.toBeNull();
    expect(access.permissionsIn).toHaveBeenCalledWith(WORKSPACE, READ_TOKEN);
  });

  it('contains nothing for someone who may not read the workspace', async () => {
    expect(await exported({ permitted: false })).toBeNull();
  });
});

describe('ResourceConfigurationHandler', () => {
  const one = (
    kind: ResourceConfigurationQuery['kind'],
    id: string,
    over: Parameters<typeof handlers>[0] = {},
  ) =>
    handlers(over).resource.execute(
      new ResourceConfigurationQuery(kind, id, READ_TOKEN),
    );

  it.each([
    ['workspace', 'ws_1', 'acme'],
    ['team', 'team_ops', 'ops'],
    ['line', 'line_delivery', 'core/delivery'],
    ['integration', 'integration_linear', 'ops/linear'],
    ['hook', 'hook_audit', 'core/audit'],
    ['harness-profile', 'profile_careful', 'core/careful'],
    ['secret', 'secret_1', 'LINEAR_API_KEY'],
    ['workspace-token-trust', 'token_trust_1', 'github-main'],
    ['runner-trust', 'trust_1', 'cluster'],
    ['runner-pool', 'pool_1', 'burst'],
    ['workspace-runners', 'declared_1', 'acme'],
  ] as const)(
    'contains the %s with its whole workspace around it',
    async (kind, id, address) => {
      const found = await one(kind, id);

      expect(found?.resource).toMatchObject({ kind, id, address });
      expect(found?.configuration.resources).toContainEqual(found?.resource);
      expect(found?.configuration.workspaceSlug).toBe('acme');
    },
  );

  it('contains a pool with its labels, its limit and the token version it pulls with', async () => {
    expect((await one('runner-pool', 'pool_1'))?.resource).toEqual({
      kind: 'runner-pool',
      ownedBy: 'workspace',
      id: 'pool_1',
      address: 'burst',
      key: 'burst',
      labels: ['gpu'],
      maxRuns: 4,
      tokenVersion: 1,
      provision: null,
    });
  });

  it('contains the trusts and pools the workspace declares, and nothing more', async () => {
    const declared = (await one('workspace-runners', 'declared_1'))?.resource;

    expect(declared).toMatchObject({ trusts: ['cluster'], pools: ['burst'] });
    expect(declared).not.toHaveProperty('runners');
  });

  it('contains nothing for someone who may not read the workspace', async () => {
    expect(await one('line', 'line_delivery', { permitted: false })).toBeNull();
  });

  it('contains nothing its workspace does not have', async () => {
    expect(await one('skill', 'skill_gone')).toBeNull();
    expect(await one('runner-pool', 'pool_gone')).toBeNull();
  });
});
