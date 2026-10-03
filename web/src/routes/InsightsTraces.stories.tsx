import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import { insightsAt } from '@/stories/fixtures/insights';
import {
  emptyTraces,
  failTraces,
  seedTeam,
  seedTraces,
} from '@/stories/fixtures/team-section';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('traces');

const meta = {
  title: 'Team/Insights/Traces',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeam}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyTraces}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTraces}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTraces}>
      {routes}
    </StoryPage>
  ),
};
