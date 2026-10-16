import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { SetupChatView } from '@work/application/ports/chat-reader.port';
import type {
  Provisioning,
  TeamProvisioningPort,
} from '@work/application/ports/team-provisioning.port';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type { SetupStanding } from '@work/application/services/setup-standing.service';
import { SETUP_STEPS, type SetupState } from '@work/domain/services/setup-list';
import { describe, expect, it, vi } from 'vitest';

type Given = {
  member?: boolean;
  state?: Partial<SetupState>;
  hostsSandboxes?: boolean;
  chat?: SetupChatView | null;
  provisioning?: Provisioning;
};

const nothing: SetupState = {
  connectedToGitHub: false,
  hasHarness: false,
  configured: false,
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
    of: vi.fn().mockResolvedValue({
      state: { ...nothing, ...given.state },
      hostsSandboxes: given.hostsSandboxes ?? false,
      chat: given.chat ?? null,
    }),
  } as unknown as SetupStanding;

  const provisioning: TeamProvisioningPort = {
    of: vi.fn().mockResolvedValue(given.provisioning ?? 'done'),
  };

  return new OnboardingHandler(workspaces, setup, provisioning);
};

const read = (given: Given = {}) =>
  handler(given).execute(new OnboardingQuery('team_1', 'user_1'));

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
      read({ state: { connectedToGitHub: true }, hostsSandboxes: true }),
    ).resolves.toMatchObject({ canSetUp: true });
    await expect(
      read({
        state: { connectedToGitHub: true, hasHarness: true },
        hostsSandboxes: false,
      }),
    ).resolves.toMatchObject({ canSetUp: false });
  });

  it('links the setup chat only for whoever started it', async () => {
    const chat = {
      id: 'chat_1',
      pullRequest: null,
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
