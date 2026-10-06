import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
import { seedMemory } from '@/stories/fixtures/insights-memory';
import {
  emptyTools,
  failTools,
  seedTools,
} from '@/stories/fixtures/insights-tools';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('tools');

const alongside =
  (seed: (client: QueryClient) => void) => (client: QueryClient) => {
    seedMemory(client);
    seed(client);
  };

const meta = {
  title: 'Team/Insights/Tools and skills/Skills and tools',
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
    <StoryPage at={at} seed={alongside(emptyTools)}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={alongside(failTools)}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(seedTools)}>
      {routes}
    </StoryPage>
  ),
};
