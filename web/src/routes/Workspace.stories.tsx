import type { Meta, StoryObj } from '@storybook/react-vite';
import { APP_TABS_KEY } from '@/lib/app-tabs';
import { inboxPath } from '@/lib/inbox';
import { runnersPath } from '@/lib/runner';
import { teamSectionPath } from '@/lib/team';
import { GROWTH_ID, PLATFORM_ID, SLUG, WORKSPACE } from '@/mocks/world';
import { settingsWorld } from '@/mocks/world/settings';
import {
  choice,
  type PageArgs,
  pageStory,
  toggle,
} from '@/stories/application';

type ShellArgs = {
  readonly showing: 'inbox' | 'not-found' | 'settings' | 'setting-up';
  readonly tabs: boolean;
};

const OPEN_TABS = {
  tabs: [
    { id: 'tab_inbox', path: inboxPath(SLUG), title: 'Inbox' },
    {
      id: 'tab_runs',
      path: teamSectionPath(SLUG, PLATFORM_ID, 'runs'),
      title: 'Runs',
    },
    {
      id: 'tab_agent',
      path: teamSectionPath(SLUG, GROWTH_ID, 'agent'),
      title: 'Agent',
    },
  ],
  activeId: 'tab_inbox',
};

const openTabs = () => {
  try {
    localStorage.setItem(`${APP_TABS_KEY}.${SLUG}`, JSON.stringify(OPEN_TABS));
  } catch {}
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
    world: ({ showing, tabs }) => {
      if (tabs) {
        openTabs();
      }
      if (showing === 'setting-up') {
        settingsWorld().settingUp.push(WORKSPACE.id);
      }
    },
    args: { showing: 'inbox', tabs: false },
    argTypes: {
      showing: choice('Showing', {
        inbox: 'Inbox',
        'not-found': 'Workspace not found',
        settings: 'Settings',
        'setting-up': 'Setting up',
      }),
      tabs: toggle('Open tabs'),
    },
  }),
} satisfies Meta<PageArgs & ShellArgs>;

export default meta;

export const Shell: StoryObj<typeof meta> = {};
