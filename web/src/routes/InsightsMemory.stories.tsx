import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
import {
  emptyMemory,
  failMemory,
  seedBenchmarkedMemory,
  seedMemory,
} from '@/stories/fixtures/insights-memory';
import { seedTools } from '@/stories/fixtures/insights-tools';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('tools');

const alongside =
  (seed: (client: QueryClient) => void) => (client: QueryClient) => {
    seedTools(client);
    seed(client);
  };

const meta = {
  title: 'Team/Insights/Tools and skills/Memory',
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
    <StoryPage at={at} seed={alongside(emptyMemory)}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={alongside(failMemory)}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(seedMemory)}>
      {routes}
    </StoryPage>
  ),
};

export const Benchmarked: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(seedBenchmarkedMemory)}>
      {routes}
    </StoryPage>
  ),
};
