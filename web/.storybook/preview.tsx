import type { Preview } from '@storybook/react-vite';
import { onlineManager } from '@tanstack/react-query';
import { sb } from 'storybook/test';
import '../src/index.css';

sb.mock(import('../src/hooks/api/useSession.ts'));

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: [
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
          [
            'Items',
            'Setup steps',
            'Proposed memories',
            'Grade a run',
            'Alerts',
          ],
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
              'Flow',
              'Pull requests',
              'Stations',
              'Changes',
              'Before and after',
              'Candidates',
              'People',
              'Cost',
              'Tools',
              'Memory',
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
