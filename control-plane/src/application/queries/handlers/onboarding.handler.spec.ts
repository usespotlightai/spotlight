import type { GitHubAppPort } from '@application/ports/github-app.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { OnboardingHandler } from '@application/queries/handlers/onboarding.handler';
import { OnboardingQuery } from '@application/queries/onboarding.query';
import type {
  TeamFacts,
  TeamSetup,
} from '@application/services/team-setup.service';
import { SETUP_STEPS } from '@domain/services/setup-list';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { describe, expect, it, vi } from 'vitest';

type LineStub = {
  key: string;
  name: string;
  harness: string | null;
  repositories: readonly string[];
};

type Given = {
  member?: boolean;
  facts?: Partial<TeamFacts>;
  installUrl?: string | null;
  owner?: string | null;
  lines?: readonly LineStub[];
};

/** A line as the repository hands it back, only what the handler reads of it. */
const asLine = (line: LineStub) => ({
  key: { value: line.key },
  name: { value: line.name },
  worked: line.harness ? [{ harness: { value: line.harness } }] : [],
  repositories: { all: line.repositories.map((value) => ({ value })) },
});

const nothing: TeamFacts = {
  hasRunner: false,
  connectedToGitHub: false,
  installation: null,
  configRepository: null,
  hasConfiguration: false,
  listening: [],
};

const handler = (given: Given = {}) => {
  const workspaces = {
    findTeamForMember: vi
      .fn()
      .mockResolvedValue(
        given.member === false
          ? null
          : { teamId: 'team_1', workspaceId: 'ws_1', slug: 'acme' },
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
  } as never;

  return new OnboardingHandler(workspaces, setup, app, lines, {
    all: () => [
      {
        source: 'linear',
        name: 'Linear',
        summary: 'Move a task on when its issue is done.',
        secretCalled: 'the signing secret',
      },
    ],
    fileFor: () => null,
  });
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
          name: 'Software Delivery',
          harness: 'claude-code',
          repositories: ['acme/api'],
        },
        {
          key: 'factory-improvement',
          name: 'Factory Improvement',
          harness: null,
          repositories: [],
        },
      ],
    });

    expect(onboarding?.lines).toEqual([
      {
        key: 'delivery',
        name: 'Software Delivery',
        harness: 'claude-code',
        repositories: ['acme/api'],
      },
      {
        key: 'factory-improvement',
        name: 'Factory Improvement',
        harness: null,
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

    expect(step(onboarding, 'tools')?.done).toBe(true);
  });

  it('says where each step is taken, for the team asking', async () => {
    const onboarding = await read();

    expect(step(onboarding, 'runner')?.where).toBe('/w/acme/runners');
    expect(step(onboarding, 'tools')?.where).toBe(
      '/w/acme/team/team_1/integrations',
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

  // A link is worth having and not worth failing over.
  it('still answers where GitHub would not say what the App is called', async () => {
    await expect(read({ installUrl: null })).resolves.toMatchObject({
      installUrl: null,
    });
  });

  it('offers the tools a team can be listening to', async () => {
    const onboarding = await read();

    expect(onboarding?.tools.map((each) => each.source)).toContain('linear');
    expect(onboarding?.tools.every((each) => !each.chosen)).toBe(true);
  });

  it('ticks off the tools it is already listening to', async () => {
    const onboarding = await read({ facts: { listening: ['linear'] } });

    expect(
      onboarding?.tools.find((each) => each.source === 'linear')?.chosen,
    ).toBe(true);
  });

  it('names the account repositories are under, so only the name is typed', async () => {
    await expect(
      read({
        facts: { installation: GitHubInstallation.of('42') },
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
