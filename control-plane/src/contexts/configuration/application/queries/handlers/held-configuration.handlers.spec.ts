import type {
  HarnessProfileResourcesPort,
  KeptProfile,
} from '@configuration/application/ports/harness-profile-resources.port';
import type { HeldIntegrationsPort } from '@configuration/application/ports/held-integrations.port';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import { ResourceConfigurationHandler } from '@configuration/application/queries/handlers/resource-configuration.handler';
import { WorkspaceConfigurationHandler } from '@configuration/application/queries/handlers/workspace-configuration.handler';
import { ResourceConfigurationQuery } from '@configuration/application/queries/resource-configuration.query';
import { WorkspaceConfigurationQuery } from '@configuration/application/queries/workspace-configuration.query';
import type { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import { HeldConfigurations } from '@configuration/application/services/held-configurations.service';
import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
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
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';
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
  keepsValue: true,
  valueVersion: 1,
});

const runnerOf = (id: string, name: string) => ({
  id,
  address: name,
  workspaceId: WORKSPACE,
  name,
  labels: [],
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

const DECLARED = {
  id: 'declared_1',
  address: 'acme',
  workspaceId: WORKSPACE,
  runners: ['build-1'],
  trusts: ['cluster'],
};

const handlers = (over: { cleared?: boolean } = {}) => {
  const access = {
    clearanceIn: vi.fn(async () =>
      over.cleared === false
        ? null
        : {
            workspaceId: WORKSPACE,
            slug: 'acme',
            configures: false,
            managesSecrets: false,
            managesRunners: false,
            administers: false,
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
    source: string,
    definition: Readonly<Record<string, unknown>> = {},
  ) => ({
    id,
    address: `${team.key}/${source}`,
    teamId: team.id,
    source,
    definition,
    secretsWorn: [],
  });
  const lineOf = (teamId: TeamId, key: string) => ({
    id: `line_${key}`,
    version: 1,
    teamId,
    key,
    definition: { key, name: key },
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
  } satisfies HeldIntegrationsPort;
  const profileOf = (id: string, key: string): KeptProfile => ({
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
    onTeam: vi.fn((kept: KeptProfile, teamKey: string) => ({
      id: kept.id,
      version: kept.version,
      address: `${teamKey}/${String(kept.definition.key)}`,
      teamId: kept.teamId.value,
      key: String(kept.definition.key),
      permissions: { allow: [], ask: [], deny: [] },
      mcpServers: [],
      native: {},
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
      runners: [
        runnerOf('runner_2', 'build-2'),
        runnerOf('runner_1', 'build-1'),
      ],
      trusts: [TRUST],
      declared: DECLARED,
    })),
    runnerWithId: vi.fn(async (id: string) =>
      id === 'runner_1' ? runnerOf('runner_1', 'build-1') : null,
    ),
    trustWithId: vi.fn(async (id: string) => (id === TRUST.id ? TRUST : null)),
    declaredWithId: vi.fn(async (id: string) =>
      id === DECLARED.id ? DECLARED : null,
    ),
  } satisfies RunnerConfigurationPort;
  const held = new HeldConfigurations(
    teams,
    lines,
    skills,
    integrations,
    profiles,
    profileViews,
    secrets,
    runners,
  );

  return {
    access,
    workspace: new WorkspaceConfigurationHandler(access, workspaces, held),
    resource: new ResourceConfigurationHandler(
      access,
      workspaces,
      teams,
      lines,
      skills,
      integrations,
      profiles,
      secrets,
      runners,
      held,
    ),
  };
};

describe('WorkspaceConfigurationHandler', () => {
  const exported = (over: Parameters<typeof handlers>[0] = {}) =>
    handlers(over).workspace.execute(
      new WorkspaceConfigurationQuery(WORKSPACE.value, READ_TOKEN),
    );

  it('holds the workspace, what it holds itself, and each team with what it holds', async () => {
    const held = await exported();

    expect(held?.workspaceId).toBe('ws_1');
    expect(held?.workspaceSlug).toBe('acme');
    expect(
      held?.resources.map((each) => `${each.kind} ${each.address}`).sort(),
    ).toEqual(
      [
        'workspace acme',
        'secret LINEAR_API_KEY',
        'secret SLACK_TOKEN',
        'runner build-1',
        'runner build-2',
        'runner-trust cluster',
        'workspace-runners acme',
        'team core',
        'line core/delivery',
        'line core/triage',
        'integration core/linear',
        'integration core/slack',
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
    expect(access.clearanceIn).toHaveBeenCalledWith(WORKSPACE, READ_TOKEN);
  });

  it('holds nothing for someone who may not read the workspace', async () => {
    expect(await exported({ cleared: false })).toBeNull();
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
    ['harness-profile', 'profile_careful', 'core/careful'],
    ['secret', 'secret_1', 'LINEAR_API_KEY'],
    ['runner', 'runner_1', 'build-1'],
    ['runner-trust', 'trust_1', 'cluster'],
    ['workspace-runners', 'declared_1', 'acme'],
  ] as const)(
    'holds the %s with its whole workspace around it',
    async (kind, id, address) => {
      const held = await one(kind, id);

      expect(held?.resource).toMatchObject({ kind, id, address });
      expect(held?.configuration.resources).toContainEqual(held?.resource);
      expect(held?.configuration.workspaceSlug).toBe('acme');
    },
  );

  it('holds nothing for someone who may not read the workspace', async () => {
    expect(await one('line', 'line_delivery', { cleared: false })).toBeNull();
  });

  it('holds nothing its workspace does not hold', async () => {
    expect(await one('skill', 'skill_gone')).toBeNull();
    expect(await one('runner', 'runner_enrolled_by_trust')).toBeNull();
  });
});
