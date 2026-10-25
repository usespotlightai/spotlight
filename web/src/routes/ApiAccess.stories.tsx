import type { Meta, StoryObj } from '@storybook/react-vite';
import { apiAccessPath } from '@/lib/settings';
import { SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import type { Script } from '@/stories/ScriptedApplication';

type Doing = 'nothing' | 'creating' | 'created' | 'revoking';

type TokensArgs = {
  readonly doing: Doing;
};

const openCreate: Script = async (screen, user) => {
  await user.click(await screen.findByRole('button', { name: 'Create token' }));
};

const SCRIPTS: Record<Doing, Script | undefined> = {
  nothing: undefined,
  creating: openCreate,
  created: async (screen, user) => {
    await openCreate(screen, user);
    await user.type(
      await screen.findByRole('textbox', { name: 'Name' }),
      'deploys',
    );
    await user.keyboard('{Enter}');
  },
  revoking: async (screen, user) => {
    (
      await screen.findByRole('button', { name: 'Actions for terraform' })
    ).focus();
    await user.keyboard('{Enter}');
    await user.click(
      await screen.findByRole('menuitem', { name: 'Revoke token' }),
    );
  },
};

const meta = {
  title: 'Settings/Workspace/API access',
  ...pageStory<TokensArgs>({
    at: apiAccessPath(SLUG),
    args: { doing: 'nothing' },
    argTypes: {
      doing: choice('Doing', {
        nothing: 'Nothing',
        creating: 'Creating a token',
        created: 'Token created',
        revoking: 'Revoking a token',
      }),
    },
    script: ({ doing }) => SCRIPTS[doing],
  }),
} satisfies Meta<PageArgs & TokensArgs>;

export default meta;

export const ApiAccess: StoryObj<typeof meta> = { name: 'API access' };
