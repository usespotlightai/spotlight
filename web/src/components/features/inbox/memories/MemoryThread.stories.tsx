import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { MemoryThread } from '@/components/features/inbox/memories/MemoryThread';
import { teamCrumb } from '@/lib/team-crumb';
import { failMutations } from '@/stories/failMutations';
import { failRetriesRun, seedInbox } from '@/stories/fixtures/inbox';
import {
  failMemoryReview,
  MEMORIES_ITEM_ID,
  RUN_ID,
  SLUG,
  seedMemoriesDecided,
  TASK_ID,
  TASK_TITLE,
  TEAM_ID,
} from '@/stories/fixtures/memories';
import { StoryPage } from '@/stories/StoryPage';

const TRAIL = [
  teamCrumb(SLUG, { id: TEAM_ID, name: 'Platform' }),
  { label: TASK_TITLE },
];

const seeded =
  (...seeds: ((client: QueryClient) => void)[]) =>
  (client: QueryClient) => {
    for (const seed of seeds) {
      seed(client);
    }
  };

function Showing({ seed }: { seed?: (client: QueryClient) => void }) {
  return (
    <StoryPage at={`/w/${SLUG}/inbox/${MEMORIES_ITEM_ID}`} seed={seed}>
      <Route
        path="/w/:slug/inbox/:itemId"
        element={
          <MemoryThread
            slug={SLUG}
            teamId={TEAM_ID}
            taskId={TASK_ID}
            runId={RUN_ID}
            trail={TRAIL}
          />
        }
      />
    </StoryPage>
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

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={failRetriesRun} />,
};

export const ReviewFailed: Story = {
  name: 'Memories not loaded',
  render: () => <Showing seed={seeded(seedInbox, failMemoryReview)} />,
};

export const WithData: Story = {
  render: () => <Showing seed={seedInbox} />,
};

export const Editing: Story = {
  render: () => <Showing seed={seedInbox} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: /^Edit/ }))[0],
    );
  },
};

export const NotSaved: Story = {
  render: () => <Showing seed={seeded(seedInbox, failMutations)} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      (await canvas.findAllByRole('button', { name: /^Approve memory / }))[0],
    );
  },
};

export const Decided: Story = {
  render: () => <Showing seed={seeded(seedInbox, seedMemoriesDecided)} />,
};
