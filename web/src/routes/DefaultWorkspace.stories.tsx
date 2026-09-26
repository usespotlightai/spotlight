import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { DefaultWorkspace } from '@/routes/DefaultWorkspace';
import {
  emptyWorkspaces,
  failWorkspaces,
  seedWorkspaces,
} from '@/stories/fixtures/workspaces';
import { Redirected } from '@/stories/Redirected';
import { StoryShell } from '@/stories/StoryShell';

const routes = (
  <>
    <Route index element={<DefaultWorkspace />} />
    <Route path="/w/:slug" element={<Redirected />} />
    <Route path="/workspaces/new" element={<Redirected />} />
  </>
);

const meta = {
  title: 'Workspace/Default workspace',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <StoryShell at="/" seed={emptyWorkspaces}>
      {routes}
    </StoryShell>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryShell at="/" seed={failWorkspaces}>
      {routes}
    </StoryShell>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryShell at="/" seed={seedWorkspaces}>
      {routes}
    </StoryShell>
  ),
};
