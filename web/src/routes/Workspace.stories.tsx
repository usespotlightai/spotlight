import type { Meta, StoryObj } from '@storybook/react-vite';

import { THEME_STORAGE_KEY } from '@/hooks/useTheme';
import { APP_TABS_KEY } from '@/lib/app-tabs';
import { inboxPath } from '@/lib/inbox';
import { RECENT_PAGES_KEY } from '@/lib/recent-pages';
import { runnersPath } from '@/lib/runner';
import { linePath, teamPath, teamSectionPath } from '@/lib/team';
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
  readonly split: boolean;
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

const openTabs = (split: boolean) => {
  try {
    localStorage.setItem(
      `${APP_TABS_KEY}.${SLUG}`,
      JSON.stringify(split ? { ...OPEN_TABS, splitId: 'tab_runs' } : OPEN_TABS),
    );
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
    world: ({ showing, tabs, split }) => {
      if (tabs || split) {
        openTabs(split);
      }
      if (showing === 'setting-up') {
        settingsWorld().settingUp.push(WORKSPACE.id);
      }
    },
    args: { showing: 'inbox', tabs: false, split: false },
    argTypes: {
      showing: choice('Showing', {
        inbox: 'Inbox',
        'not-found': 'Workspace not found',
        settings: 'Settings',
        'setting-up': 'Setting up',
      }),
      tabs: toggle('Open tabs'),
      split: toggle('Split view'),
    },
  }),
} satisfies Meta<PageArgs & ShellArgs>;

export default meta;

export const Shell: StoryObj<typeof meta> = {};

export const SplitView: StoryObj<typeof meta> = {
  args: { split: true },
};

const openThemeMenu = (theme: 'light' | 'dark'): StoryObj<typeof meta> => ({
  beforeEach: () => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    return () => localStorage.removeItem(THEME_STORAGE_KEY);
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: new RegExp(WORKSPACE.name) }),
    );
  },
});

export const ThemeMenuLight = openThemeMenu('light');

export const ThemeMenuDark = openThemeMenu('dark');

const RECENT_PAGES = [
  {
    path: `${teamPath(SLUG, PLATFORM_ID)}/tasks/task_272`,
    title: 'Show recently viewed pages in the tab strip',
    label: 'SPO-272',
  },
  {
    path: `${teamPath(SLUG, PLATFORM_ID)}/runs/run_41`,
    title: 'Run 41',
  },
  {
    path: `${teamPath(SLUG, PLATFORM_ID)}/tasks/task_268`,
    title: 'Let a station keep its own judge',
    label: 'SPO-268',
  },
  { path: linePath(SLUG, PLATFORM_ID, 'line_1'), title: 'Delivery' },
  { path: teamSectionPath(SLUG, GROWTH_ID, 'memory'), title: 'Memory' },
  { path: runnersPath(SLUG), title: 'Runners' },
];

export const RecentlyViewed: StoryObj<typeof meta> = {
  beforeEach: () => {
    Object.defineProperty(window, 'spotlightDesktop', {
      configurable: true,
      value: {
        platform: 'linux',
        setBadge: () => {},
        show: () => {},
        authorize: () => {},
      },
    });
    localStorage.setItem(
      `${RECENT_PAGES_KEY}.${SLUG}`,
      JSON.stringify(RECENT_PAGES),
    );

    return () => {
      Reflect.deleteProperty(window, 'spotlightDesktop');
      localStorage.removeItem(`${RECENT_PAGES_KEY}.${SLUG}`);
    };
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Recently viewed' }),
    );
  },
};
