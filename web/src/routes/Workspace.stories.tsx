import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { inboxPath } from '@/lib/inbox';
import { runnersPath } from '@/lib/runner';
import { Inbox } from '@/routes/Inbox';
import { InboxIndex } from '@/routes/InboxIndex';
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
    <Route path="inbox" element={<Inbox />}>
      <Route index element={<InboxIndex />} />
    </Route>
    <Route path="settings/runners" element={<Runners />} />
  </Route>
);

const at = inboxPath(SLUG);

const meta = {
  title: 'Workspace/Shell',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryShell at={at}>{routes}</StoryShell>,
};

export const NotFound: Story = {
  render: () => (
    <StoryShell at={at} seed={missingWorkspace}>
      {routes}
    </StoryShell>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryShell at={at} seed={failWorkspace}>
      {routes}
    </StoryShell>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryShell at={at} seed={seedWorkspace}>
      {routes}
    </StoryShell>
  ),
};

export const InSettings: Story = {
  render: () => (
    <StoryShell at={runnersPath(SLUG)} seed={seedWorkspace}>
      {routes}
    </StoryShell>
  ),
};
