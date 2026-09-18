import type { GitHubAppPort } from '@github/application/ports/github-app.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type {
  TeamFacts,
  TeamSetup,
} from '@work/application/services/team-setup.service';
import { SETUP_STEPS } from '@work/domain/services/setup-list';
import { describe, expect, it, vi } from 'vitest';

type LineStub = {
  key: string;
  name: string;
  harness: string | null;
  model?: string | null;
  effort?: string | null;
  repositories: readonly string[];
};

type Given = {
  member?: boolean;
  facts?: Partial<TeamFacts>;
  installUrl?: string | null;
  owner?: string | null;
  lines?: readonly LineStub[];
  withFile?: boolean;
};

const asLine = (line: LineStub) => ({
  model: null,
  effort: null,
  ...line,
});

const nothing: TeamFacts = {
  hasRunner: false,
  connectedToGitHub: false,
  configRepository: null,
  hasConfiguration: false,
  listening: [],
};

const handler = (given: Given = {}) => {
  const workspaces = {
    findTeamForMember: vi.fn().mockResolvedValue(
      given.member === false
        ? null
        : {
            teamId: 'team_1',
            workspaceId: 'ws_1',
            slug: 'acme',
            teamKey: 'platform',
          },
    ),
  } as unknown as WorkspaceReaderPort;

  const setup = {
    factsFor: vi.fn().mockResolvedValue({ ...nothing, ...given.facts }),
  } as unknown as TeamSetup;

  const app: GitHubAppPort = {
    installUrl: vi
      .fn()
      .mockResolvedValue(
        given.installUrl === undefined
          ? 'https://github.com/apps/spotlight/installations/new'
          : given.installUrl,
      ),
    owner: vi.fn().mockResolvedValue(given.owner ?? null),
  };

  const lines = {
    ofTeam: vi.fn().mockResolvedValue((given.lines ?? []).map(asLine)),
  };

  return new OnboardingHandler(
    workspaces,
    setup,
    app,
    lines,
    {
      all: () => [
        {
          source: 'linear',
          name: 'Linear',
          summary: 'Move a task on when its issue is done.',
        },
      ],
      fileFor: () =>
        given.withFile ? 'version: 1\nintegration: linear\n' : null,
      secretsFor: () =>
        given.withFile ? [SecretName.of('LINEAR_WEBHOOK_SECRET')] : [],
    },
    {
      of: (slug: string, teamKey: string, source: string) =>
        `https://hooks.example.com/api/webhooks/w/${slug}/t/${teamKey}/${source}`,
    },
  );
};

const read = (given: Given = {}) =>
  handler(given).execute(new OnboardingQuery('team_1', 'user_1'));

const step = (of: Awaited<ReturnType<typeof read>>, key: string) =>
  of?.steps.find((each) => each.key === key);

describe('OnboardingHandler', () => {
  it('answers with nothing where the team is not the caller’s', async () => {
    await expect(read({ member: false })).resolves.toBeNull();
  });

  it('offers the list as the things it names', async () => {
    const onboarding = await read();

    expect(onboarding?.steps.map((each) => each.key)).toEqual([...SETUP_STEPS]);
    expect(onboarding?.steps.every((each) => !each.done)).toBe(true);
  });

  it('offers each line its harness and repositories to set up', async () => {
    const onboarding = await read({
      lines: [
        {
          key: 'delivery',
          name: 'Delivery',
          harness: 'claude-code',
          model: 'claude-sonnet-5',
          effort: 'high',
          repositories: ['acme/api'],
        },
        {
          key: 'factory',
          name: 'Factory',
          harness: null,
          repositories: [],
        },
      ],
    });

    expect(onboarding?.lines).toEqual([
      {
        key: 'delivery',
        name: 'Delivery',
        harness: 'claude-code',
        model: 'claude-sonnet-5',
        effort: 'high',
        repositories: ['acme/api'],
      },
      {
        key: 'factory',
        name: 'Factory',
        harness: null,
        model: null,
        effort: null,
        repositories: [],
      },
    ]);
  });

  it('ticks a step off once it has been taken', async () => {
    const onboarding = await read({ facts: { hasRunner: true } });

    expect(step(onboarding, 'runner')?.done).toBe(true);
    expect(step(onboarding, 'github')?.done).toBe(false);
  });

  it('is done choosing tools once it is listening to one', async () => {
    const onboarding = await read({ facts: { listening: ['linear'] } });

    expect(step(onboarding, 'integrations')?.done).toBe(true);
  });

  it('says where each step is taken, for the team asking', async () => {
    const onboarding = await read();

    expect(step(onboarding, 'runner')?.where).toBe('/w/acme/runners');
    expect(step(onboarding, 'integrations')?.where).toBe(
      '/w/acme/team/team_1/settings/integrations',
    );
  });

  it('sends nobody anywhere for the pull request', async () => {
    expect(step(await read(), 'configuration')?.where).toBeNull();
  });

  it('says where to install the App while it is not installed', async () => {
    await expect(read()).resolves.toMatchObject({
      connectedToGitHub: false,
      installUrl: 'https://github.com/apps/spotlight/installations/new',
    });
  });

  it('still answers where GitHub would not say what the App is called', async () => {
    await expect(read({ installUrl: null })).resolves.toMatchObject({
      installUrl: null,
    });
  });

  it('offers the tools a team can be listening to', async () => {
    const onboarding = await read();

    expect(onboarding?.integrations.map((each) => each.source)).toContain(
      'linear',
    );
  });

  it('says which secrets each tool reads, and where its host delivers', async () => {
    const onboarding = await read({ withFile: true });
    const linear = onboarding?.integrations.find(
      (each) => each.source === 'linear',
    );

    expect(linear?.secrets).toEqual(['LINEAR_WEBHOOK_SECRET']);
    expect(linear?.deliverTo).toBe(
      'https://hooks.example.com/api/webhooks/w/acme/t/platform/linear',
    );
  });

  it('names the account repositories are under, so only the name is typed', async () => {
    await expect(
      read({
        facts: { connectedToGitHub: true },
        owner: 'acme',
      }),
    ).resolves.toMatchObject({
      repositoryOwner: 'acme',
    });
  });

  it('names no account until the team is connected', async () => {
    await expect(read()).resolves.toMatchObject({ repositoryOwner: null });
  });
});
