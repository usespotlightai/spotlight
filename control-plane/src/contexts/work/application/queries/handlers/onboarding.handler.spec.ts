import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type { WorkspaceSetup } from '@work/application/services/workspace-setup.service';
import { SETUP_STEPS, type SetupState } from '@work/domain/services/setup-list';
import { describe, expect, it, vi } from 'vitest';

type Given = {
  member?: boolean;
  state?: Partial<SetupState>;
};

const nothing: SetupState = {
  connectedToGitHub: false,
  hasHarness: false,
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
    stateOf: vi.fn().mockResolvedValue({ ...nothing, ...given.state }),
  } as unknown as WorkspaceSetup;

  return new OnboardingHandler(workspaces, setup);
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

  it('ticks a step off once it has been taken', async () => {
    const onboarding = await read({ state: { hasHarness: true } });

    expect(step(onboarding, 'harness')?.done).toBe(true);
    expect(step(onboarding, 'github')?.done).toBe(false);
  });
});
