import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import {
  emptyFlow,
  failFlow,
  insightsAt,
  loadInsights,
  seedFlow,
} from '@/stories/fixtures/insights';
import { seedPullRequests } from '@/stories/fixtures/insights-pull-requests';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('productivity');

const alongside =
  (seed: (client: QueryClient) => void) => (client: QueryClient) => {
    seedPullRequests(client);
    seed(client);
  };

const meta = {
  title: 'Team/Insights/Productivity/Where work waits',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(loadInsights)}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(emptyFlow)}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={alongside(failFlow)}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(seedFlow)}>
      {routes}
    </StoryPage>
  ),
};
