import type { Meta, StoryObj } from '@storybook/react-vite';

import { secretsPath } from '@/lib/settings';
import { SLUG } from '@/mocks/world';
import { settingsWorld } from '@/mocks/world/settings';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import type { Script } from '@/stories/ScriptedApplication';

type Doing = 'nothing' | 'setting';

type SecretsArgs = {
  readonly doing: Doing;
  readonly unused: boolean;
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
    args: { doing: 'nothing', unused: false },
    argTypes: {
      doing: choice('Doing', {
        nothing: 'Nothing',
        setting: 'Setting a value',
      }),
      unused: { name: 'A secret no run receives', control: 'boolean' },
    },
    world: ({ unused }) => {
      if (unused) {
        const world = settingsWorld();
        world.secrets = world.secrets.map((secret) =>
          secret.name === 'LINEAR_API_KEY'
            ? { ...secret, reach: { ...secret.reach, usedByRuns: false } }
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
  args: { unused: true },
};
