import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { SetupChatView } from '@work/application/ports/chat-reader.port';
import type {
  Provisioning,
  TeamProvisioningPort,
} from '@work/application/ports/team-provisioning.port';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import { SETUP_STEPS, type SetupState } from '@work/domain/services/setup-list';
import { describe, expect, it, vi } from 'vitest';

type Options = {
  member?: boolean;
  state?: Partial<SetupState>;
  hasEgressCapableRunner?: boolean;
  chat?: SetupChatView | null;
  provisioning?: Provisioning;
  admin?: boolean;
};

const nothing: SetupState = {
  connectedToGitHub: false,
  hasHarness: false,
  configured: false,
};

const handler = (options: Options = {}) => {
  const workspaces = {
    findTeamForMember: vi.fn().mockResolvedValue(
      options.member === false
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
    of: vi.fn().mockResolvedValue({
      state: { ...nothing, ...options.state },
      hasEgressCapableRunner: options.hasEgressCapableRunner ?? false,
      chat: options.chat ?? null,
    }),
  } as unknown as SetupStatus;

  const provisioning: TeamProvisioningPort = {
    of: vi.fn().mockResolvedValue(options.provisioning ?? 'done'),
  };

  const access = {
    permissionsIn: vi
      .fn()
      .mockResolvedValue({ isAdmin: options.admin ?? true }),
  } as unknown as WorkspaceAccessPort;

  return new OnboardingHandler(workspaces, access, setup, provisioning);
};

const read = (options: Options = {}) =>
  handler(options).execute(new OnboardingQuery('team_1', 'user_1'));

const step = (of: Awaited<ReturnType<typeof read>>, key: string) =>
  of?.steps.find((each) => each.key === key);

describe('OnboardingHandler', () => {
  it('answers with nothing where the team is not the caller’s', async () => {
    await expect(read({ member: false })).resolves.toBeNull();
  });

  it('tells whether Spotlight has set the team up yet', async () => {
    await expect(read()).resolves.toMatchObject({ provisioning: 'done' });
    await expect(read({ provisioning: 'pending' })).resolves.toMatchObject({
      provisioning: 'pending',
    });
  });

  it('offers the list as the things it names', async () => {
    const onboarding = await read();

    expect(onboarding?.steps.map((each) => each.key)).toEqual([...SETUP_STEPS]);
    expect(onboarding?.steps.every((each) => !each.done)).toBe(true);
  });

  it('ticks a step off once it has been taken', async () => {
    const onboarding = await read({ state: { hasHarness: true } });

    expect(step(onboarding, 'harness')?.done).toBe(true);
    expect(step(onboarding, 'github')?.done).toBe(false);
  });

  it('offers a setup chat once the GitHub App is installed and a host runs sandboxes', async () => {
    await expect(
      read({
        state: { connectedToGitHub: true },
        hasEgressCapableRunner: true,
      }),
    ).resolves.toMatchObject({ canSetUp: true });
    await expect(
      read({
        state: { connectedToGitHub: true, hasHarness: true },
        hasEgressCapableRunner: false,
      }),
    ).resolves.toMatchObject({ canSetUp: false });
  });

  it('says whether the viewer is an owner or admin, who alone may set up', async () => {
    await expect(read()).resolves.toMatchObject({ viewerIsAdmin: true });
    await expect(read({ admin: false })).resolves.toMatchObject({
      viewerIsAdmin: false,
    });
  });

  it('shows the CI that the setup created for its repository', async () => {
    const ci = {
      defaultBranch: 'main',
      defaultBranchProtected: false,
      variables: 'written' as const,
    };

    await expect(
      read({
        chat: {
          id: 'chat_1',
          repository: 'acme/infra',
          pullRequest: null,
          ci,
          startedById: 'user_1',
          startedBy: 'Ada',
        },
      }),
    ).resolves.toMatchObject({
      setupChat: { repository: 'acme/infra', ci },
    });
  });

  it('links the setup chat only for whoever started it', async () => {
    const chat = {
      id: 'chat_1',
      repository: 'acme/infra',
      pullRequest: null,
      ci: null,
      startedById: 'user_2',
      startedBy: 'Grace',
    };

    await expect(read({ chat })).resolves.toMatchObject({
      setupChat: { id: null, startedBy: 'Grace' },
    });
    await expect(
      read({ chat: { ...chat, startedById: 'user_1' } }),
    ).resolves.toMatchObject({ setupChat: { id: 'chat_1' } });
  });
});
