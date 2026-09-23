import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import type {
  TeamFacts,
  TeamSetup,
} from '@work/application/services/team-setup.service';
import { SETUP_STEPS } from '@work/domain/services/setup-list';
import { describe, expect, it, vi } from 'vitest';

type Given = {
  member?: boolean;
  facts?: Partial<TeamFacts>;
};

const nothing: TeamFacts = {
  hasRunner: false,
  connectedToGitHub: false,
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
});
