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
