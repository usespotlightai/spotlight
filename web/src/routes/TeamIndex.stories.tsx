import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamPath } from '@/lib/team';
import { TeamIndex } from '@/routes/TeamIndex';
import {
  emptyLines,
  failLines,
  SLUG,
  seedLines,
  TEAM_ID,
} from '@/stories/fixtures/workspaces';
import { Redirected } from '@/stories/Redirected';
import { StoryPage } from '@/stories/StoryPage';

const AT = teamPath(SLUG, TEAM_ID);

const routes = (
  <Route path="/w/:slug/team/:teamId">
    <Route index element={<TeamIndex />} />
    <Route path="lines/:lineId" element={<Redirected />} />
    <Route path=":section" element={<Redirected />} />
  </Route>
);

const meta = {
  title: 'Team/Landing',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={AT}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={AT} seed={emptyLines}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={AT} seed={failLines}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={AT} seed={seedLines}>
      {routes}
    </StoryPage>
  ),
};
