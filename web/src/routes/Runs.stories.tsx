import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamSectionPath } from '@/lib/team';
import { Runs } from '@/routes/Runs';
import {
  emptyRuns,
  failRuns,
  SLUG,
  seedRuns,
  seedTeam,
  TEAM_ID,
} from '@/stories/fixtures/team-section';
import { StoryPage } from '@/stories/StoryPage';

const routes = <Route path="/w/:slug/team/:teamId/runs" element={<Runs />} />;

const at = teamSectionPath(SLUG, TEAM_ID, 'runs');

const meta = {
  title: 'Team/Runs/All runs',
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
    <StoryPage at={at} seed={emptyRuns}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failRuns}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedRuns}>
      {routes}
    </StoryPage>
  ),
};
