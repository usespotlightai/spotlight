import type { Meta, StoryObj } from '@storybook/react-vite';
import { MEMBER_SHOWS, membersPath, SHOW_PARAM } from '@/lib/members';
import { SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import type { Script } from '@/stories/ScriptedApplication';

type Doing =
  | 'nothing'
  | 'inviting'
  | 'invited'
  | 'changing-role'
  | 'resending'
  | 'revoking';

type Filter = 'everyone' | (typeof MEMBER_SHOWS)[number]['value'];

type MembersArgs = {
  readonly doing: Doing;
  readonly filter: Filter;
};

const INVITED =
  'jordan.lee@acme.dev, maya.chen@acme.dev, ines.costa@acme.dev, bounce@acme.dev';

const openInvite: Script = async (screen, user) => {
  await user.click(
    await screen.findByRole('button', { name: 'Invite people' }),
  );
};

const actOnInvite =
  (action: string): Script =>
  async (screen, user) => {
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for jordan.lee@acme.dev',
      }),
    );
    await user.click(await screen.findByRole('menuitem', { name: action }));
  };

const SCRIPTS: Record<Doing, Script | undefined> = {
  nothing: undefined,
  inviting: openInvite,
  invited: async (screen, user) => {
    await openInvite(screen, user);
    await user.type(
      await screen.findByRole('textbox', { name: 'Email addresses' }),
      INVITED,
    );
    await user.click(screen.getByRole('button', { name: 'Send invites' }));
  },
  'changing-role': async (screen, user) => {
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Maya Chen' }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: 'Change role' }),
    );
  },
  resending: actOnInvite('Resend invite'),
  revoking: actOnInvite('Revoke invite'),
};

const meta = {
  title: 'Settings/Workspace/Members',
  ...pageStory<MembersArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ filter }) =>
      filter === 'everyone'
        ? membersPath(SLUG)
        : `${membersPath(SLUG)}?${SHOW_PARAM}=${filter}`,
    args: { doing: 'nothing', filter: 'everyone' },
    argTypes: {
      doing: choice('Doing', {
        nothing: 'Nothing',
        inviting: 'Inviting people',
        invited: 'Invites sent',
        'changing-role': 'Changing a role',
        resending: 'Resending an invite',
        revoking: 'Revoking an invite',
      }),
      filter: choice('Filter', {
        everyone: 'Everyone',
        ...Object.fromEntries(
          MEMBER_SHOWS.map((each) => [each.value, each.label]),
        ),
      } as Record<Filter, string>),
    },
    script: ({ doing }) => SCRIPTS[doing],
  }),
} satisfies Meta<PageArgs & MembersArgs>;

export default meta;

export const Members: StoryObj<typeof meta> = {};
