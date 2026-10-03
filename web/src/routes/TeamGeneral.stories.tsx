import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamSettingsPath } from '@/lib/settings';
import { TeamGeneral } from '@/routes/TeamGeneral';
import {
  failTeamGeneral,
  SLUG,
  seedEmptyTeamGeneral,
  seedTeamGeneral,
  TEAM_ID,
} from '@/stories/fixtures/team';
import { StoryPage } from '@/stories/StoryPage';

const at = teamSettingsPath(SLUG, TEAM_ID, 'general');

const routes = (
  <Route
    path="/w/:slug/settings/team/:teamId/general"
    element={<TeamGeneral />}
  />
);

const meta = {
  title: 'Settings/Team/General',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={seedEmptyTeamGeneral}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTeamGeneral}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeamGeneral}>
      {routes}
    </StoryPage>
  ),
};
