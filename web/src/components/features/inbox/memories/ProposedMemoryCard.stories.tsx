import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';

import { ProposedMemoryCard } from '@/components/features/inbox/memories/ProposedMemoryCard';
import type { ProposedMemory } from '@/lib/memory';

const RETIRING: ProposedMemory = {
  id: 'memory_staging_restart',
  kind: 'environment',
  body: 'The staging queue worker must be restarted after every deploy, or it keeps the old retry limits.',
  source: 'run',
  state: 'proposed',
  scope: 'line',
  repository: 'acme/worker',
  paths: [],
  supersedes: null,
  editable: false,
  inactiveMemories: [],
  similarTo: null,
  retires: {
    memoryId: 'memory_staging',
    handle: 'M-43',
    reason:
      'The worker reloads its retry limits on deploy since the config watcher landed; no restart is needed.',
  },
  decision: null,
  harness: null,
  steps: [],
  notes: [],
};

const meta = {
  title: 'Inbox/Proposed memories/Retiring',
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="max-w-2xl p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: { memory: RETIRING },
  render: ({ memory }) => (
    <ProposedMemoryCard
      memory={memory}
      position={1}
      pending={false}
      onApprove={() => undefined}
      onReject={() => undefined}
      onRestore={() => undefined}
    />
  ),
} satisfies Meta<{ memory: ProposedMemory }>;

export default meta;

export const Retiring: StoryObj<typeof meta> = {};

export const NoLongerApplies: StoryObj<typeof meta> = {
  args: { memory: { ...RETIRING, inactiveMemories: ['M-43'] } },
};

export const RepeatsAMemory: StoryObj<typeof meta> = {
  args: {
    memory: {
      ...RETIRING,
      body: 'npm ci fails in the sandbox on the better-sqlite3 node-gyp build; use npm ci --ignore-scripts.',
      scope: 'team',
      repository: null,
      editable: true,
      retires: null,
      similarTo: {
        memoryId: 'memory_2',
        handle: 'M-2',
        body: 'qa-tidepool: the runner image has no make/g++, so better-sqlite3 cannot build. Use `npm install --ignore-scripts` (better-sqlite3 still loads) until the image is fixed.',
        reason:
          'It gives the same advice as M-2: skip the better-sqlite3 build scripts because the image cannot compile it.',
      },
    },
  },
};
