import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamSettingsPath } from '@/lib/settings';
import { TeamSkills } from '@/routes/TeamSkills';
import {
  emptyTeamSkills,
  failTeamSkills,
  seedTeamSkills,
} from '@/stories/fixtures/skills';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';
import { StoryPage } from '@/stories/StoryPage';

const at = teamSettingsPath(SLUG, TEAM_ID, 'skills');

const routes = (
  <Route
    path="/w/:slug/settings/team/:teamId/skills"
    element={<TeamSkills />}
  />
);

const meta = {
  title: 'Settings/Team/Skills',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyTeamSkills}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTeamSkills}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeamSkills}>
      {routes}
    </StoryPage>
  ),
};
