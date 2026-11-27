import type { Meta, StoryObj } from '@storybook/react-vite';

import { secretsPath } from '@/lib/settings';
import { SLUG } from '@/mocks/world';
import { settingsWorld } from '@/mocks/world/settings';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import type { Script } from '@/stories/ScriptedApplication';

type Doing = 'nothing' | 'setting';

type Reach = 'received' | 'unused' | 'undeliverable';

type SecretsArgs = {
  readonly doing: Doing;
  readonly reach: Reach;
};

const SCRIPTS: Record<Doing, Script | undefined> = {
  nothing: undefined,
  setting: async (screen, user) => {
    await user.click(
      await screen.findByRole('button', {
        name: 'Set value of STAGING_LOGIN_PASSWORD',
      }),
    );
  },
};

const meta = {
  title: 'Settings/Workspace/Secrets',
  ...pageStory<SecretsArgs>({
    at: secretsPath(SLUG),
    args: { doing: 'nothing', reach: 'received' },
    argTypes: {
      doing: choice('Doing', {
        nothing: 'Nothing',
        setting: 'Setting a value',
      }),
      reach: choice('LINEAR_API_KEY reaches runs', {
        received: 'Yes',
        unused: 'Nothing uses it',
        undeliverable: 'No runner pool has egress',
      }),
    },
    world: ({ reach }) => {
      if (reach !== 'received') {
        const world = settingsWorld();
        world.secrets = world.secrets.map((secret) =>
          secret.name === 'LINEAR_API_KEY'
            ? {
                ...secret,
                reach: {
                  usedByRuns: reach !== 'unused',
                  deliverable: reach !== 'undeliverable',
                },
              }
            : secret,
        );
      }
    },
    script: ({ doing }) => SCRIPTS[doing],
  }),
} satisfies Meta<PageArgs & SecretsArgs>;

export default meta;

export const Secrets: StoryObj<typeof meta> = {};

export const Unused: StoryObj<typeof meta> = {
  args: { reach: 'unused' },
};

export const NoEgress: StoryObj<typeof meta> = {
  args: { reach: 'undeliverable' },
};
