import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { workspacePath } from '@/lib/workspace';
import { WorkspaceIndex } from '@/routes/WorkspaceIndex';
import { emptyTeams, SLUG, seedTeams } from '@/stories/fixtures/workspaces';
import { Redirected } from '@/stories/Redirected';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug">
    <Route index element={<WorkspaceIndex />} />
    <Route path="team/:teamId" element={<Redirected />} />
  </Route>
);

const meta = {
  title: 'Pages/WorkspaceIndex',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={workspacePath(SLUG)}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={workspacePath(SLUG)} seed={emptyTeams}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={workspacePath(SLUG)} seed={seedTeams}>
      {routes}
    </StoryPage>
  ),
};
