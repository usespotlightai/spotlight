import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import {
  insightsAt,
  loadInsights,
  seedFlow,
} from '@/stories/fixtures/insights';
import { seedPullRequests } from '@/stories/fixtures/insights-pull-requests';
import {
  emptyShipping,
  failShipping,
  seedShipping,
} from '@/stories/fixtures/insights-shipping';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('productivity');

const alongside =
  (seed: (client: QueryClient) => void) => (client: QueryClient) => {
    seedFlow(client);
    seedPullRequests(client);
    seed(client);
  };

const meta = {
  title: 'Team/Insights/Productivity/What the agents ship',
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
    <StoryPage at={at} seed={alongside(emptyShipping)}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={alongside(failShipping)}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(seedShipping)}>
      {routes}
    </StoryPage>
  ),
};
