import type { QueryClient } from '@tanstack/react-query';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import type { OnboardingResponseDto, SetupStepResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { seedGitHub } from '@/stories/fixtures/github';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const SETUP_ITEM_ID = 'task_setup:0';

export const BODY =
  '1. Start a runner.\n2. Install the GitHub App.\n3. Set up your lines.\n4. Choose your integrations.';

type StepKey = SetupStepResponseDto['key'];

const STEPS: Omit<SetupStepResponseDto, 'done'>[] = [
  {
    key: 'runner',
    title: 'Start a runner',
    description: 'The machine that does the work.',
    where: `/w/${SLUG}/runners`,
  },
  {
    key: 'github',
    title: 'Install the GitHub App',
    description:
      'So Spotlight can read your repositories and open pull requests.',
    where: null,
  },
  {
    key: 'integrations',
    title: 'Choose your integrations',
    description: 'What this team listens to.',
    where: `/w/${SLUG}/team/${TEAM_ID}/settings/integrations`,
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

export const seedRunnersEnrolled = seed(['runner']);

export const seedGitHubInstalled = seed(['runner', 'github']);

export const seedSetupDone = seed(['runner', 'github', 'integrations']);

export const failSetup = (client: QueryClient) =>
  failQuery(client, onboardingKeys.forTeam(TEAM_ID));
