import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SetupChatView } from '@work/application/ports/chat-reader.port';
import type { TeamWelcomesPort } from '@work/application/ports/team-welcomes.port';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type { SetupStatus } from '@work/application/services/setup-status.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { SETUP_STEPS, type SetupState } from '@work/domain/services/setup-list';
import { describe, expect, it, vi } from 'vitest';

type Options = {
  member?: boolean;
  state?: Partial<SetupState>;
  hasEgressCapableRunner?: boolean;
  chat?: SetupChatView | null;
  origin?: 'sign-up' | 'configuration';
  welcomed?: boolean;
  admin?: boolean;
};

const nothing: SetupState = {
  connectedToGitHub: false,
  hasHarness: false,
  configured: false,
};

const handler = (options: Options = {}) => {
  const access = partial<WorkAccess>({
    seenTeam: vi.fn().mockResolvedValue(
      options.member === false
        ? null
        : {
            teamId: TeamId.of('team_1'),
            workspaceId: WorkspaceId.of('ws_1'),
            slug: 'acme',
            teamKey: 'platform',
            origin: options.origin ?? 'sign-up',
          },
    ),
    isAdminOf: vi.fn().mockResolvedValue(options.admin ?? true),
    opensChat: vi.fn(
      async (chat: { readonly startedBy: UserId }, viewer: UserId) =>
        chat.startedBy.equals(viewer),
    ),
  });

  const setup = partial<SetupStatus>({
    of: vi.fn().mockResolvedValue({
      state: { ...nothing, ...options.state },
      runners: { platform: false },
      hasEgressCapableRunner: options.hasEgressCapableRunner ?? false,
      chat: options.chat ?? null,
    }),
  });

  const welcomes = partial<TeamWelcomesPort>({
    welcomed: vi.fn().mockResolvedValue(options.welcomed ?? true),
  });

  return new OnboardingHandler(access, setup, welcomes);
};

const read = (options: Options = {}) =>
  handler(options).execute(new OnboardingQuery('team_1', 'user_1'));

const step = (of: Awaited<ReturnType<typeof read>>, key: string) =>
  of?.steps.find((each) => each.key === key);

describe('OnboardingHandler', () => {
  it('answers with nothing where the team is not the caller’s', async () => {
    await expect(read({ member: false })).resolves.toBeNull();
  });

  it('tells whether Spotlight has welcomed a team made at sign-up yet', async () => {
    await expect(read()).resolves.toMatchObject({ provisioning: 'done' });
    await expect(read({ welcomed: false })).resolves.toMatchObject({
      provisioning: 'pending',
    });
  });

  it('reads a team made by configuration as set up at once', async () => {
    await expect(
      read({ origin: 'configuration', welcomed: false }),
    ).resolves.toMatchObject({ provisioning: 'done' });
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

  it('says what keeps the viewer from starting a setup chat, as SetupAdmission refuses it', async () => {
    await expect(read({ admin: false })).resolves.toMatchObject({
      canSetUp: false,
      setupRefusal: 'needs-an-admin',
    });
    await expect(
      read({
        admin: false,
        state: { connectedToGitHub: true },
        hasEgressCapableRunner: true,
      }),
    ).resolves.toMatchObject({
      canSetUp: true,
      setupRefusal: 'needs-an-admin',
    });
    await expect(read()).resolves.toMatchObject({
      setupRefusal: 'code-unreachable',
    });
    await expect(
      read({ state: { connectedToGitHub: true, hasHarness: true } }),
    ).resolves.toMatchObject({ setupRefusal: 'needs-egress' });
    await expect(
      read({
        state: { connectedToGitHub: true },
        hasEgressCapableRunner: true,
      }),
    ).resolves.toMatchObject({ setupRefusal: null });
  });

  it('says the setup waits for a host once the GitHub App is installed and no host is connected', async () => {
    const onboarding = await read({ state: { connectedToGitHub: true } });

    expect(onboarding).toMatchObject({
      canSetUp: false,
      setupRefusal: 'needs-egress',
    });
    expect(step(onboarding, 'github')?.done).toBe(true);
    expect(step(onboarding, 'harness')?.done).toBe(false);
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
          startedAt: new Date(0),
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
      startedAt: new Date(0),
    };

    await expect(read({ chat })).resolves.toMatchObject({
      setupChat: { id: null, startedBy: 'Grace' },
    });
    await expect(
      read({ chat: { ...chat, startedById: 'user_1' } }),
    ).resolves.toMatchObject({ setupChat: { id: 'chat_1' } });
  });
});
