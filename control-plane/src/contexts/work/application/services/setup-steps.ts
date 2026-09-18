import type { SetupStepDto } from '@work/application/dto/onboarding.dto';
import {
  SETUP_STEPS,
  type SetupState,
  type SetupStepKey,
  TAKEN,
} from '@work/domain/services/setup-list';

interface Whereabouts {
  readonly slug: string;
  readonly teamId: string;
}

interface Wording {
  readonly title: string;
  readonly says: string;
  readonly where: (at: Whereabouts) => string | null;
}

const team = (at: Whereabouts): string => `/w/${at.slug}/team/${at.teamId}`;

const WORDING: Record<SetupStepKey, Wording> = {
  runner: {
    title: 'Start a runner',
    says: 'Set up the machine where your team’s work will run. You can connect an existing environment or create a new one.',
    where: (at) => `/w/${at.slug}/runners`,
  },
  github: {
    title: 'Install the GitHub App',
    says: 'Connect Spotlight to the repository your team will work with. This lets Spotlight interact with your code through GitHub.',
    where: (at) => `${team(at)}/settings/integrations`,
  },
  repository: {
    title: 'Choose a configuration repository',
    says: 'Choose the repository where this team’s Spotlight configuration is saved — the setup pull request opens here, and it is read back from here on every push. Pick an existing one, or enter a new name and Spotlight will create it.',
    where: (at) => `${team(at)}/settings/integrations`,
  },
  configuration: {
    title: 'Set up your lines',
    says: 'Choose the harness and repositories for each line, then open the setup pull request. Nothing is written until you do, and nothing changes until you merge it.',
    where: () => null,
  },
  integrations: {
    title: 'Choose your integrations',
    says: 'Pick the integrations your team should have access to. Spotlight will create a starter configuration for each one, which you can customize later.',
    where: (at) => `${team(at)}/settings/integrations`,
  },
};

export const listed = (at: Whereabouts): string =>
  SETUP_STEPS.map((key, index) => {
    const { title, says, where } = WORDING[key];
    const going = where(at);

    return `${index + 1}. ${going ? `[${title}](${going})` : title}. ${says}`;
  }).join('\n');

export const shownFor = (
  state: SetupState,
  at: Whereabouts,
): readonly SetupStepDto[] =>
  SETUP_STEPS.map((key) => ({
    key,
    title: WORDING[key].title,
    description: WORDING[key].says,
    where: WORDING[key].where(at),
    done: TAKEN[key](state),
  }));
