import type { Meta, StoryObj } from '@storybook/react-vite';

import { secretsPath } from '@/lib/settings';
import { SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import type { Script } from '@/stories/ScriptedApplication';

type Doing = 'nothing' | 'setting';

type SecretsArgs = {
  readonly doing: Doing;
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
    args: { doing: 'nothing' },
    argTypes: {
      doing: choice('Doing', {
        nothing: 'Nothing',
        setting: 'Setting a value',
      }),
    },
    script: ({ doing }) => SCRIPTS[doing],
  }),
} satisfies Meta<PageArgs & SecretsArgs>;

export default meta;

export const Secrets: StoryObj<typeof meta> = {};
