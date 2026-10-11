import type { SetupStepDto } from '@work/application/dto/onboarding.dto';
import {
  SETUP_STEPS,
  type SetupState,
  type SetupStepKey,
  TAKEN,
} from '@work/domain/services/setup-list';

interface Wording {
  readonly title: string;
  readonly says: string;
}

const WORDING: Record<SetupStepKey, Wording> = {
  github: {
    title: 'Install the GitHub App',
    says: 'Connect Spotlight to the repository your team will work with. This lets Spotlight interact with your code through GitHub.',
  },
  harness: {
    title: 'Connect a host',
    says: 'Connect a computer that runs agents with a harness such as Claude Code, from the Runners page. Spotlight’s built-in lines start working as soon as it reports in.',
  },
  configuration: {
    title: 'Set up configuration as code',
    says: 'Pick a repository and folder for the team’s Terraform. The agent learns how the team works from its code and tools, then opens a pull request there.',
  },
};

export const listed = (): string =>
  SETUP_STEPS.map((key, index) => {
    const { title, says } = WORDING[key];

    return `${index + 1}. ${title}. ${says}`;
  }).join('\n');

export const shownFor = (state: SetupState): readonly SetupStepDto[] =>
  SETUP_STEPS.map((key) => ({
    key,
    title: WORDING[key].title,
    description: WORDING[key].says,
    done: TAKEN[key](state),
  }));
