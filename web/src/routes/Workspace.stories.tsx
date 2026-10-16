import type { Meta, StoryObj } from '@storybook/react-vite';
import { inboxPath } from '@/lib/inbox';
import { runnersPath } from '@/lib/runner';
import { SLUG, WORKSPACE } from '@/mocks/world';
import { settingsWorld } from '@/mocks/world/settings';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type ShellArgs = {
  readonly showing: 'inbox' | 'not-found' | 'settings' | 'setting-up';
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
    world: ({ showing }) => {
      if (showing === 'setting-up') {
        settingsWorld().settingUp.push(WORKSPACE.id);
      }
    },
    args: { showing: 'inbox' },
    argTypes: {
      showing: choice('Showing', {
        inbox: 'Inbox',
        'not-found': 'Workspace not found',
        settings: 'Settings',
        'setting-up': 'Setting up',
      }),
    },
  }),
} satisfies Meta<PageArgs & ShellArgs>;

export default meta;

export const Shell: StoryObj<typeof meta> = {};
