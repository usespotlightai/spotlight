import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { chatPath } from '@/lib/chat';
import { AgentChat } from '@/routes/AgentChat';
import {
  CHAT_ID,
  emptyChat,
  failChat,
  SLUG,
  seedChat,
  TEAM_ID,
} from '@/stories/fixtures/chat';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/agent/:chatId" element={<AgentChat />} />
);

const at = chatPath(SLUG, TEAM_ID, CHAT_ID);

const meta = {
  title: 'Team/Agent/Chat',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyChat}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failChat}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedChat}>
      {routes}
    </StoryPage>
  ),
};
