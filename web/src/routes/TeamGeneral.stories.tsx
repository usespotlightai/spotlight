import type { Meta, StoryObj } from '@storybook/react-vite';
import { teamSettingsPath } from '@/lib/settings';
import { GROWTH_ID, PLATFORM_ID, SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import type { Script } from '@/stories/ScriptedApplication';

type Doing = 'nothing' | 'adding' | 'inviting';

type GeneralArgs = {
  readonly team: string;
  readonly doing: Doing;
};

const openAdd: Script = async (screen, user) => {
  await user.click(await screen.findByRole('button', { name: 'Add a member' }));
};

const SCRIPTS: Record<Doing, Script | undefined> = {
  nothing: undefined,
  adding: openAdd,
  inviting: async (screen, user) => {
    await openAdd(screen, user);
    await user.click(
      await screen.findByRole('menuitem', { name: 'Invite someone new' }),
    );
  },
};

const meta = {
  title: 'Settings/Team/General',
  ...pageStory<GeneralArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ team }) => teamSettingsPath(SLUG, team, 'general'),
    args: { team: PLATFORM_ID, doing: 'nothing' },
    argTypes: {
      team: choice('Team', {
        [PLATFORM_ID]: 'Platform',
        [GROWTH_ID]: 'Growth',
      }),
      doing: choice('Doing', {
        nothing: 'Nothing',
        adding: 'Adding a member',
        inviting: 'Inviting someone new',
      }),
    },
    script: ({ doing }) => SCRIPTS[doing],
  }),
} satisfies Meta<PageArgs & GeneralArgs>;

export default meta;

export const General: StoryObj<typeof meta> = {};
