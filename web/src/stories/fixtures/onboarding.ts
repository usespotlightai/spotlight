import type { QueryClient } from '@tanstack/react-query';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import type { OnboardingResponseDto, SetupStepResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { seedGitHub } from '@/stories/fixtures/github';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const SETUP_ITEM_ID = 'task_setup:0';

export const BODY = '1. Install the GitHub App.\n2. Connect a host.';

type StepKey = SetupStepResponseDto['key'];

const STEPS: Omit<SetupStepResponseDto, 'done'>[] = [
  {
    key: 'github',
    title: 'Install the GitHub App',
    description:
      'So Spotlight can read your repositories and open pull requests.',
  },
  {
    key: 'harness',
    title: 'Connect a host',
    description:
      'A runner with an agent harness installed, such as Claude Code.',
  },
];

const seed =
  (done: readonly StepKey[]) =>
  (client: QueryClient): void => {
    seedGitHub(done.includes('github'))(client);
    client.setQueryData(onboardingKeys.forTeam(TEAM_ID), {
      steps: STEPS.map((step) => ({ ...step, done: done.includes(step.key) })),
    } satisfies OnboardingResponseDto);
  };

export const seedFreshSetup = seed([]);

export const seedGitHubInstalled = seed(['github']);

export const seedSetupDone = seed(['github', 'harness']);

export const failSetup = (client: QueryClient) =>
  failQuery(client, onboardingKeys.forTeam(TEAM_ID));
