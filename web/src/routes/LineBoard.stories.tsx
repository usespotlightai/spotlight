import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { linePath } from '@/lib/team';
import { LineBoard } from '@/routes/LineBoard';
import {
  emptyBoard,
  failBoard,
  LINE_ID,
  SLUG,
  seedBoard,
  seedWorkspace,
  TEAM_ID,
} from '@/stories/fixtures/board';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/lines/:lineId" element={<LineBoard />} />
);

const at = linePath(SLUG, TEAM_ID, LINE_ID);

const meta = {
  title: 'Team/Lines/Board',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={seedWorkspace}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyBoard}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failBoard}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedBoard}>
      {routes}
    </StoryPage>
  ),
};
