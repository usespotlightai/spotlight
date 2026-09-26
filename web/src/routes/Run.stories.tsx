import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { runPath } from '@/lib/run';
import { Run } from '@/routes/Run';
import {
  emptyRun,
  failRun,
  RUN_ID,
  SLUG,
  seedRun,
  TEAM_ID,
} from '@/stories/fixtures/run';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/runs/:runId" element={<Run />} />
);

const at = runPath(SLUG, TEAM_ID, RUN_ID);

const meta = {
  title: 'Team/Runs/Run',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyRun}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failRun}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedRun}>
      {routes}
    </StoryPage>
  ),
};
