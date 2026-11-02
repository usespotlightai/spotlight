import type { Meta, StoryObj } from '@storybook/react-vite';
import { emailsPath } from '@/lib/emails';
import { SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import type { Script } from '@/stories/ScriptedApplication';

type Doing = 'nothing' | 'adding' | 'added' | 'acting';

type EmailsArgs = {
  readonly doing: Doing;
};

const openAdd: Script = async (screen, user) => {
  await user.click(await screen.findByRole('button', { name: 'Add email' }));
};

const SCRIPTS: Record<Doing, Script | undefined> = {
  nothing: undefined,
  adding: openAdd,
  added: async (screen, user) => {
    await openAdd(screen, user);
    await user.type(
      await screen.findByRole('textbox', { name: 'Email' }),
      'sam@slack-workspace.example',
    );
    await user.keyboard('{Enter}');
  },
  acting: async (screen, user) => {
    (
      await screen.findByRole('button', {
        name: 'Actions for sam@contractor.example',
      })
    ).focus();
    await user.keyboard('{Enter}');
  },
};

const meta = {
  title: 'Settings/Account/Emails',
  ...pageStory<EmailsArgs>({
    at: emailsPath(SLUG),
    args: { doing: 'nothing' },
    argTypes: {
      doing: choice('Doing', {
        nothing: 'Nothing',
        adding: 'Adding an email',
        added: 'Email added',
        acting: 'Actions on an expired link',
      }),
    },
    script: ({ doing }) => SCRIPTS[doing],
  }),
} satisfies Meta<PageArgs & EmailsArgs>;

export default meta;

export const Emails: StoryObj<typeof meta> = { name: 'Emails' };
