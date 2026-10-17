import { describe, expect, it } from 'vitest';
import {
  createRunnerPool,
  createWorkspaceToken,
  deleteWorkspaceToken,
  disconnectIntegration,
  listHarnesses,
  listIntegrationConnections,
  listRepositories,
  listRunnerActivity,
  listRunnerPools,
  listRunners,
  listTeamSkills,
  listWorkspaceTokens,
  readConfiguration,
  readGitHub,
  readOnboarding,
  readTeam,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { WORKSPACE_ID } from '@/mocks/world/settings';

const slug = { path: { slug: SLUG }, throwOnError: true } as const;

const platform = { path: { teamId: PLATFORM_ID }, throwOnError: true } as const;

const workspace = {
  path: { workspaceId: WORKSPACE_ID },
  throwOnError: true,
} as const;

describe('the mock settings', () => {
  serveMockApi();

  it('answers the harnesses every station picks from', async () => {
    const { data } = await listHarnesses(slug);

    expect(data.map((each) => each.id)).toEqual([
      'claude-code',
      'codex',
      'cursor',
    ]);
    expect(data[0]?.models.map((each) => each.id)).toEqual([
      'opus',
      'sonnet',
      'haiku',
    ]);
    expect(data[0]?.efforts).toEqual(['low', 'medium', 'high']);
  });

  it('answers the repositories the GitHub App can see', async () => {
    const { data: github } = await readGitHub(slug);
    const { data: repositories } = await listRepositories(slug);

    expect(github.connected).toBe(true);
    expect(repositories.map((each) => each.fullName)).toContain('acme/worker');
  });

  it('answers runners busy with the running core runs', async () => {
    const { data: fleet } = await listRunners(slug);
    const { data: activity } = await listRunnerActivity(slug);

    expect(fleet.hosts.map((each) => each.name)).toContain('build-box-1');
    expect(activity.map((each) => each.currentRun.id).sort()).toEqual([
      'run_checkout_1',
      'run_latency_1',
      'run_pricing_2',
      'run_retries_3',
      'run_survey_1',
    ]);
    expect(
      activity.every((each) =>
        fleet.runners.some((runner) => runner.id === each.runnerId),
      ),
    ).toBe(true);
  });

  it('creates a runner pool and hands back its token once', async () => {
    const before = await listRunnerPools(workspace);
    const created = await createRunnerPool({
      ...workspace,
      headers: { 'Idempotency-Key': 'key-1' },
      body: { key: 'gpu-farm' },
    });
    const after = await listRunnerPools(workspace);

    expect(before.data.items.map((each) => each.key)).toEqual([
      'build-farm',
      'ephemeral',
    ]);
    expect(created.response.headers.get('Spotlight-Pool-Token')).toBeTruthy();
    expect(after.data.items.map((each) => each.key)).toContain('gpu-farm');
  });

  it('creates and revokes workspace tokens', async () => {
    const {
      data: { items: tokens },
    } = await listWorkspaceTokens(workspace);
    const created = await createWorkspaceToken({
      ...workspace,
      headers: { 'Idempotency-Key': 'key-2' },
      body: { name: 'deploys', scopes: ['read'] },
    });
    await deleteWorkspaceToken({
      path: { id: tokens[0]?.id ?? '' },
      headers: { 'If-Match': '1' },
      throwOnError: true,
    });
    const { data: after } = await listWorkspaceTokens(workspace);

    expect(tokens.map((each) => each.name)).toEqual([
      'terraform',
      'plans',
      'trust-setup',
    ]);
    expect(
      created.response.headers.get('Spotlight-Workspace-Token'),
    ).toBeTruthy();
    expect(after.items.map((each) => each.name)).toEqual([
      'deploys',
      'plans',
      'trust-setup',
    ]);
  });

  it('answers the team resource', async () => {
    const { data: team } = await readTeam({
      path: { id: PLATFORM_ID },
      throwOnError: true,
    });

    expect(team).toMatchObject({ key: 'platform', name: 'Platform' });
  });

  it('answers the team’s integrations, connections and skills', async () => {
    const { data: configuration } = await readConfiguration(platform);
    const { data: connections } = await listIntegrationConnections(platform);
    const { data: skills } = await listTeamSkills(platform);

    expect(
      configuration.integrations.find((each) => each.integration === 'linear'),
    ).toMatchObject({
      connectionStatus: 'connected',
      linkedAccount: '@acme-bot',
    });
    expect(
      configuration.integrations.flatMap(({ integration, spec }) =>
        spec ? [[integration, spec.kind, spec.tools, spec.problem]] : [],
      ),
    ).toEqual([
      ['payments-api', 'openapi', 14, null],
      ['billing', 'graphql', 1, null],
      ['honeycomb', 'mcp', 24, null],
      [
        'statuspage',
        'mcp',
        0,
        'could not be read: status.acme.dev answered 401',
      ],
    ]);
    expect(connections.mine.map((each) => each.integration)).toEqual([
      'linear',
    ]);
    expect(connections.people?.length).toBe(4);
    expect(skills.skills.map((each) => each.key)).toContain(
      'grafana-dashboards',
    );
  });

  it('deletes only my own account when I disconnect, leaving the team’s', async () => {
    await disconnectIntegration({
      path: { teamId: PLATFORM_ID, integration: 'linear' },
      throwOnError: true,
    });
    const { data } = await readConfiguration(platform);
    const { data: connections } = await listIntegrationConnections(platform);

    expect(connections.mine).toEqual([]);
    expect(
      data.integrations.find((each) => each.integration === 'linear')
        ?.connectionStatus,
    ).toBe('connected');
  });

  it('answers setup done for a set-up workspace', async () => {
    const { data } = await readOnboarding(platform);

    expect(data.steps.map((each) => each.done)).toEqual([true, true, true]);
  });
});

describe('the mock settings of a fresh workspace', () => {
  serveMockApi('empty');

  it('answers nothing set up yet', async () => {
    const { data: github } = await readGitHub(slug);
    const { data: fleet } = await listRunners(slug);
    const { data: tokens } = await listWorkspaceTokens(workspace);
    const { data: configuration } = await readConfiguration(platform);
    const { data: skills } = await listTeamSkills(platform);
    const { data: onboarding } = await readOnboarding(platform);

    expect(github.connected).toBe(false);
    expect(fleet).toEqual({ hosts: [], runners: [] });
    expect(tokens.items).toEqual([]);
    expect(configuration.integrations).toEqual([]);
    expect(skills.skills).toEqual([]);
    expect(onboarding.steps.map((each) => each.done)).toEqual([
      false,
      false,
      false,
    ]);
  });
});
