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
            'Runners',
          ],
          'Inbox',
          ['Items', 'Setup steps', 'Proposed memories'],
          'Team',
          [
            'Landing',
            'Agent',
            ['Chats', 'Chat'],
            'Lines',
            ['Board', 'Station', 'Task'],
            'Runs',
            ['All runs', 'Run', 'Change stack'],
            'Observability',
            ['Traces', 'Task trace'],
            'Memory',
            'Settings',
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
