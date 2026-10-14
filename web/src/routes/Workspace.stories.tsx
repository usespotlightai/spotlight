import type { Meta, StoryObj } from '@storybook/react-vite';
import { inboxPath } from '@/lib/inbox';
import { runnersPath } from '@/lib/runner';
import { SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type ShellArgs = {
  readonly showing: 'inbox' | 'not-found' | 'settings';
};

const meta = {
  title: 'Workspace/Shell',
  ...pageStory<ShellArgs>({
    at: ({ showing }) => {
      if (showing === 'not-found') return inboxPath('nowhere');
      if (showing === 'settings') return runnersPath(SLUG);

      return inboxPath(SLUG);
    },
    scope: ({ showing }) => (showing === 'settings' ? 'page' : 'app'),
    args: { showing: 'inbox' },
    argTypes: {
      showing: choice('Showing', {
        inbox: 'Inbox',
        'not-found': 'Workspace not found',
        settings: 'Settings',
      }),
    },
  }),
} satisfies Meta<PageArgs & ShellArgs>;

export default meta;

export const Shell: StoryObj<typeof meta> = {};
