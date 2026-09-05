import type { SetupStepDto } from '@application/dto/onboarding.dto';
import {
  SETUP_STEPS,
  type SetupState,
  type SetupStepKey,
  TAKEN,
} from '@domain/services/setup-list';

interface Whereabouts {
  readonly slug: string;
  readonly teamId: string;
}

interface Wording {
  readonly title: string;
  readonly says: string;
  /** The page a person goes to, or nothing where Spotlight has no such page. */
  readonly where: (at: Whereabouts) => string | null;
}

const team = (at: Whereabouts): string => `/w/${at.slug}/team/${at.teamId}`;

/**
 * What each step is called and where it is taken. Kept out of the list
 * itself, which is the same wherever Spotlight runs while these are not.
 */
const WORDING: Record<SetupStepKey, Wording> = {
  runner: {
    title: 'Start a runner',
    says: 'Set up the machine where your team’s work will run. You can connect an existing environment or create a new one.',
    where: (at) => `/w/${at.slug}/runners`,
  },
  github: {
    title: 'Install the GitHub App',
    says: 'Connect Spotlight to the repository your team will work with. This lets Spotlight interact with your code through GitHub.',
    where: (at) => `${team(at)}/integrations`,
  },
  repository: {
    title: 'Choose a repository',
    says: 'Select the repository this team should work in, or enter a new repository name and Spotlight will create it for you.',
    where: (at) => `${team(at)}/integrations`,
  },
  configuration: {
    title: 'Merge the setup pull request',
    says: 'Spotlight will open a pull request with the initial setup. Your repository won’t be read until you review and merge it.',
    where: () => null,
  },
  tools: {
    title: 'Choose your tools',
    says: 'Pick the tools your team should have access to. Spotlight will create a starter configuration for each one, which you can customize later.',
    where: (at) => `${team(at)}/integrations`,
  },
};

/** The list as words, for wherever it cannot be shown as the things it names. */
export const listed = (at: Whereabouts): string =>
  SETUP_STEPS.map((key, index) => {
    const { title, says, where } = WORDING[key];
    const going = where(at);

    return `${index + 1}. ${going ? `[${title}](${going})` : title}. ${says}`;
  }).join('\n');

/** The list as the things it names, with what is done already ticked off. */
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
