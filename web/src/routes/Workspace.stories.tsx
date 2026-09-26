import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { runnersPath } from '@/lib/runner';
import { Runners } from '@/routes/Runners';
import { Workspace } from '@/routes/Workspace';
import {
  failWorkspace,
  missingWorkspace,
  SLUG,
  seedWorkspace,
} from '@/stories/fixtures/workspace';
import { StoryShell } from '@/stories/StoryShell';

const routes = (
  <Route path="/w/:slug" element={<Workspace />}>
    <Route path="runners" element={<Runners />} />
  </Route>
);

const meta = {
  title: 'Workspace/Shell',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryShell at={runnersPath(SLUG)}>{routes}</StoryShell>,
};

export const NotFound: Story = {
  render: () => (
    <StoryShell at={runnersPath(SLUG)} seed={missingWorkspace}>
      {routes}
    </StoryShell>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryShell at={runnersPath(SLUG)} seed={failWorkspace}>
      {routes}
    </StoryShell>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryShell at={runnersPath(SLUG)} seed={seedWorkspace}>
      {routes}
    </StoryShell>
  ),
};
