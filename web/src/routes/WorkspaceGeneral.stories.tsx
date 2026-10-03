import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { workspaceGeneralPath } from '@/lib/settings';
import { WorkspaceGeneral } from '@/routes/WorkspaceGeneral';
import {
  failWorkspace,
  SLUG,
  seedWorkspace,
} from '@/stories/fixtures/workspace';
import { StoryPage } from '@/stories/StoryPage';

const at = workspaceGeneralPath(SLUG);

const routes = (
  <Route path="/w/:slug/settings/general" element={<WorkspaceGeneral />} />
);

const meta = {
  title: 'Settings/Workspace/General',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failWorkspace}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedWorkspace}>
      {routes}
    </StoryPage>
  ),
};
