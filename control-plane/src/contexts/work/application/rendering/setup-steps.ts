import type { SetupStepDto } from '@work/application/dto/onboarding.dto';
import {
  SETUP_STEPS,
  type SetupState,
  type SetupStepKey,
  TAKEN,
} from '@work/domain/services/setup-list';

interface Wording {
  readonly title: string;
  readonly description: string;
}

// Whether the deployment gives the workspace platform runners, so the team has nothing to connect.
export interface SetupRunners {
  readonly platform: boolean;
}

const WORDING: Record<SetupStepKey, Wording> = {
  github: {
    title: 'Install the GitHub App',
    description:
      'Connect Spotlight to the repository your team will work with. This lets Spotlight interact with your code through GitHub.',
  },
  harness: {
    title: 'Connect a host',
    description:
      'On the Runners page, connect a computer that runs agents with a harness such as Claude Code. Spotlight’s built-in lines start working as soon as the host reports in.',
  },
  configuration: {
    title: 'Set up configuration as code',
    description:
      'Pick a repository and folder for the team’s Terraform, and the repositories the team works in. The agent learns how the team works from its code and tools, then opens a pull request.',
  },
};

export const CONFIGURATION_STEP: string = WORDING.configuration.title;

const PLATFORM_RUNNERS: Wording = {
  title: 'Run agents on the platform runners',
  description:
    'This deployment gives your workspace runners, so your team can start without connecting anything. Runs on them use their default image. To run a repository in another image, or to run agents on your own computers or cloud, connect a host or a pool on the Runners page.',
};

const wordingOf = (key: SetupStepKey, runners: SetupRunners): Wording =>
  key === 'harness' && runners.platform ? PLATFORM_RUNNERS : WORDING[key];

export const listed = (runners: SetupRunners): string =>
  SETUP_STEPS.map((key, index) => {
    const { title, description } = wordingOf(key, runners);

    return `${index + 1}. ${title}. ${description}`;
  }).join('\n');

export const shownFor = (
  state: SetupState,
  runners: SetupRunners,
): readonly SetupStepDto[] =>
  SETUP_STEPS.map((key) => ({
    key,
    ...wordingOf(key, runners),
    done: TAKEN[key](state),
  }));
