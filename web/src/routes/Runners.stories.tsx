import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { runnersPath } from '@/lib/runner';
import { Runners } from '@/routes/Runners';
import {
  emptyRunners,
  emptyRunnersForMember,
  failRunners,
  SLUG,
  seedRunners,
} from '@/stories/fixtures/runners';
import { StoryPage } from '@/stories/StoryPage';

const routes = <Route path="/w/:slug/settings/runners" element={<Runners />} />;

const meta = {
  title: 'Settings/Workspace/Runners',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={runnersPath(SLUG)}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={runnersPath(SLUG)} seed={emptyRunners}>
      {routes}
    </StoryPage>
  ),
};

export const EmptyForMember: Story = {
  name: 'Empty, as a member',
  render: () => (
    <StoryPage at={runnersPath(SLUG)} seed={emptyRunnersForMember}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={runnersPath(SLUG)} seed={failRunners}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={runnersPath(SLUG)} seed={seedRunners}>
      {routes}
    </StoryPage>
  ),
};
