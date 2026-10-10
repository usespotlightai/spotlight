import type { Preview } from '@storybook/react-vite';
import { onlineManager } from '@tanstack/react-query';
import { setupWorker } from 'msw/browser';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { sb } from 'storybook/test';
import '../src/index.css';

sb.mock(import('../src/hooks/api/useSession.ts'));
sb.mock(import('../src/hooks/api/useCreateWorkspaceToken.ts'), { spy: true });

const preview: Preview = {
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker();
      await worker
        .start({ onUnhandledRequest: 'bypass', quiet: true })
        .catch((failure: unknown) =>
          console.warn(
            'The mock API is off: its service worker would not start.',
            failure,
          ),
        );
      return worker;
    }),
  ],
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: [
          'Application',
          'Auth',
          ['Log in', 'Accept invite'],
          'Workspace',
          [
            'Shell',
            'Default workspace',
            'Create workspace',
            'GitHub installed',
          ],
          'Inbox',
          ['Items', 'Notices'],
          'Team',
          [
            'Landing',
            'Agent',
            ['Chats', 'Chat'],
            'Lines',
            [
              'Board',
              'Station',
              'Replay set',
              'Replay',
              'Search',
              'Task',
              'Task trace',
            ],
            'Runs',
            ['All runs', 'Run', 'Change stack'],
            'Memory',
            'Insights',
            [
              'Overview',
              'Cost',
              'People',
              'Productivity',
              ['Where work waits', 'What the agents ship', 'Pull requests'],
              'Stations',
              ['By station', 'Config changes', 'Candidates'],
              'Tools and skills',
              ['Skills and tools', 'Memory'],
              'Runs',
              'Traces',
            ],
          ],
          'Settings',
          [
            'Workspace',
            ['General', 'Runners', 'Tokens'],
            'Team',
            ['General', 'Integrations', 'Skills'],
          ],
        ],
      },
    },
  },
  beforeEach: () => {
    onlineManager.setOnline(false);

    return () => onlineManager.setOnline(true);
  },
};

export default preview;
