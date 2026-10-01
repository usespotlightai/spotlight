import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { TeamSection } from '@/routes/TeamSection';
import {
  emptyOverview,
  failOverview,
  insightsAt,
  loadInsights,
  refuseOverview,
  seedOverview,
} from '@/stories/fixtures/insights';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/:section" element={<TeamSection />} />
);

const at = insightsAt('overview');

const meta = {
  title: 'Team/Insights/Overview',
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
    <StoryPage at={at} seed={emptyOverview}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failOverview}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedOverview}>
      {routes}
    </StoryPage>
  ),
};

export const MembersOnly: Story = {
  name: 'Members only',
  render: () => (
    <StoryPage at={at} seed={refuseOverview}>
      {routes}
    </StoryPage>
  ),
};
