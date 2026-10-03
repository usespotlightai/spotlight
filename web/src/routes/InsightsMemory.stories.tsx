import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
import {
  emptyMemory,
  failMemory,
  seedBenchmarkedMemory,
  seedMemory,
} from '@/stories/fixtures/insights-memory';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('memory');

const meta = {
  title: 'Team/Insights/Memory',
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
    <StoryPage at={at} seed={emptyMemory}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failMemory}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedMemory}>
      {routes}
    </StoryPage>
  ),
};

export const Benchmarked: Story = {
  render: () => (
    <StoryPage at={at} seed={seedBenchmarkedMemory}>
      {routes}
    </StoryPage>
  ),
};
