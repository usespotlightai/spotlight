import type { QueryClient } from '@tanstack/react-query';
import { onboardingKeys } from '@/hooks/api/useOnboarding';
import { repositoryKeys } from '@/hooks/api/useRepositories';
import type { OnboardingResponseDto, SetupStepResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { emptyRunners, seedRunners } from '@/stories/fixtures/runners';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const SETUP_ITEM_ID = 'task_setup:0';

export const BODY =
  '1. Start a runner.\n2. Install the GitHub App.\n3. Choose a configuration repository.\n4. Merge the setup pull request.\n5. Choose your integrations.';

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
    key: 'repository',
    title: 'Choose a configuration repository',
    description: 'Where this team’s lines and stations live.',
    where: null,
  },
  {
    key: 'configuration',
    title: 'Merge the setup pull request',
    description: 'Nothing is read until you do.',
    where: null,
  },
  {
    key: 'integrations',
    title: 'Choose your integrations',
    description: 'What this team listens to.',
    where: `/w/${SLUG}/team/${TEAM_ID}/settings/integrations`,
  },
];

const onboarding = (
  done: readonly StepKey[],
  over: Partial<OnboardingResponseDto> = {},
): OnboardingResponseDto => ({
  steps: STEPS.map((step) => ({ ...step, done: done.includes(step.key) })),
  installUrl: 'https://github.com/apps/spotlight/installations/new',
  connectedToGitHub: false,
  configRepository: null,
  repositoryOwner: 'acme',
  lines: [
    {
      key: 'delivery',
      name: 'Delivery',
      harness: null,
      model: null,
      effort: null,
      repositories: [],
    },
    {
      key: 'factory',
      name: 'Factory',
      harness: null,
      model: null,
      effort: null,
      repositories: [],
    },
  ],
  integrations: [],
  ...over,
});

const REPOSITORIES = [
  { fullName: 'acme/api' },
  { fullName: 'acme/web' },
  { fullName: 'acme/spotlight-config' },
];

const seed =
  (state: OnboardingResponseDto, runners: (client: QueryClient) => void) =>
  (client: QueryClient) => {
    runners(client);
    client.setQueryData(repositoryKeys.forWorkspace(SLUG), REPOSITORIES);
    client.setQueryData(onboardingKeys.forTeam(TEAM_ID), state);
  };

export const seedFreshSetup = seed(onboarding([]), emptyRunners);

export const seedRunnersEnrolled = seed(onboarding(['runner']), seedRunners);

export const seedGitHubInstalled = seed(
  onboarding(['runner', 'github'], { connectedToGitHub: true }),
  seedRunners,
);

export const seedRepositoryChosen = seed(
  onboarding(['runner', 'github', 'repository'], {
    connectedToGitHub: true,
    configRepository: 'acme/spotlight-config',
  }),
  seedRunners,
);

export const seedSetupDone = seed(
  onboarding(
    ['runner', 'github', 'repository', 'configuration', 'integrations'],
    {
      connectedToGitHub: true,
      configRepository: 'acme/spotlight-config',
    },
  ),
  seedRunners,
);

export const failSetup = (client: QueryClient) =>
  failQuery(client, onboardingKeys.forTeam(TEAM_ID));
