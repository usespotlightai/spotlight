import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamSectionPath } from '@/lib/team';
import { TeamSection } from '@/routes/TeamSection';
import {
  emptyTraces,
  failTraces,
  SLUG,
  seedTeam,
  seedTraces,
  TEAM_ID,
} from '@/stories/fixtures/team-section';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/:section" element={<TeamSection />} />
);

const at = teamSectionPath(SLUG, TEAM_ID, 'observability');

const meta = {
  title: 'Pages/Team observability',
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
