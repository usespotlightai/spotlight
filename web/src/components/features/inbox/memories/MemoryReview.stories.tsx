import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { MemoryReview } from '@/components/features/inbox/memories/MemoryReview';
import { failMutations } from '@/stories/failMutations';
import {
  emptyMemoryReview,
  failMemoryReview,
  MEMORIES_ITEM_ID,
  RUN_ID,
  SLUG,
  seedMemoriesDecided,
  seedMemoryReview,
  TASK_ID,
  TEAM_ID,
} from '@/stories/fixtures/memories';
import { StoryShell } from '@/stories/StoryShell';

function Showing({ seed }: { seed?: (client: QueryClient) => void }) {
  return (
    <StoryShell at={`/w/${SLUG}/inbox/${MEMORIES_ITEM_ID}`} seed={seed}>
      <Route
        path="/w/:slug/inbox/:itemId"
        element={
          <div className="mx-auto max-w-3xl p-6">
            <MemoryReview
              slug={SLUG}
              teamId={TEAM_ID}
              taskId={TASK_ID}
              runId={RUN_ID}
            />
          </div>
        }
      />
    </StoryShell>
  );
}

const meta = {
  title: 'Inbox/Proposed memories',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <Showing />,
};

export const Empty: Story = {
  render: () => <Showing seed={emptyMemoryReview} />,
};

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={failMemoryReview} />,
};

export const WithData: Story = {
  render: () => <Showing seed={seedMemoryReview} />,
};

export const Editing: Story = {
  render: () => <Showing seed={seedMemoryReview} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: /^Edit/ })[0]);
  },
};

export const NotSaved: Story = {
  render: () => (
    <Showing
      seed={(client) => {
        seedMemoryReview(client);
        failMutations(client);
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getAllByRole('button', { name: /^Approve memory / })[0],
    );
  },
};

export const Decided: Story = {
  render: () => <Showing seed={seedMemoriesDecided} />,
};
