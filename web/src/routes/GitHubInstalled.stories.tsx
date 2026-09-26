import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { GitHubInstalled } from '@/routes/GitHubInstalled';
import {
  failConnection,
  INSTALLATION_ID,
  SLUG,
  TEAM_ID,
} from '@/stories/fixtures/workspaces';
import { StoryShell } from '@/stories/StoryShell';

const STATE = encodeURIComponent(`${SLUG}:${TEAM_ID}`);

const INSTALLED = `/github/installed?installation_id=${INSTALLATION_ID}&state=${STATE}`;

const routes = <Route path="/github/installed" element={<GitHubInstalled />} />;

const meta = {
  title: 'Workspace/GitHub installed',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <StoryShell at={INSTALLED}>{routes}</StoryShell>,
};

export const Requested: Story = {
  render: () => (
    <StoryShell at={`${INSTALLED}&setup_action=request`}>{routes}</StoryShell>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryShell at={INSTALLED} seed={failConnection}>
      {routes}
    </StoryShell>
  ),
};
