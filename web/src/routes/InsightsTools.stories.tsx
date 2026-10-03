import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
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

const meta = {
  title: 'Team/Insights/Tools',
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
    <StoryPage at={at} seed={emptyTools}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTools}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTools}>
      {routes}
    </StoryPage>
  ),
};
