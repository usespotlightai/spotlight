import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { TeamSection } from '@/routes/TeamSection';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
import {
  emptyPullRequests,
  failPullRequests,
  seedPullRequests,
} from '@/stories/fixtures/insights-pull-requests';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/:section" element={<TeamSection />} />
);

const at = insightsAt('pull-requests');

const meta = {
  title: 'Team/Insights/Pull requests',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={loadInsights}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyPullRequests}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failPullRequests}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedPullRequests}>
      {routes}
    </StoryPage>
  ),
};
