import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { changeStackPath } from '@/lib/change-stack';
import { RunChangeStack } from '@/routes/RunChangeStack';
import {
  decidedChangeStack,
  draftingChangeStack,
  emptyChangeStack,
  failChangeStack,
  largeFileChangeStack,
  reviewedChangeStack,
  seedChangeStack,
} from '@/stories/fixtures/change-stack';
import { RUN_ID, SLUG, TEAM_ID } from '@/stories/fixtures/run';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route
    path="/w/:slug/team/:teamId/runs/:runId/changes"
    element={<RunChangeStack />}
  />
);

const at = changeStackPath(SLUG, TEAM_ID, RUN_ID);

const meta = {
  title: 'Team/Runs/Change stack',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyChangeStack}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failChangeStack}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedChangeStack}>
      {routes}
    </StoryPage>
  ),
};

export const Decisions: Story = {
  render: () => (
    <StoryPage at={at} seed={decidedChangeStack}>
      {routes}
    </StoryPage>
  ),
};

export const LargeFile: Story = {
  render: () => (
    <StoryPage at={`${at}?layer=c1.l1`} seed={largeFileChangeStack}>
      {routes}
    </StoryPage>
  ),
};

export const Drafting: Story = {
  render: () => (
    <StoryPage at={at} seed={draftingChangeStack}>
      {routes}
    </StoryPage>
  ),
};

export const WithReview: Story = {
  render: () => (
    <StoryPage at={`${at}?layer=c1.l1`} seed={reviewedChangeStack}>
      {routes}
    </StoryPage>
  ),
};
