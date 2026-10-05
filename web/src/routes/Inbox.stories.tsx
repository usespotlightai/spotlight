import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { Inbox } from '@/routes/Inbox';
import { InboxIndex } from '@/routes/InboxIndex';
import { InboxItem } from '@/routes/InboxItem';
import { InboxNotice } from '@/routes/InboxNotice';
import {
  APPROVAL_ITEM_ID,
  CONNECTION_ITEM_ID,
  emptyInbox,
  FAILING_ITEM_ID,
  failInbox,
  MEMORIES_ITEM_ID,
  OPENED_ITEM_ID,
  SLUG,
  seedApproved,
  seedConnectionAsked,
  seedConnectionMet,
  seedDismissed,
  seedInbox,
} from '@/stories/fixtures/inbox';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/inbox" element={<Inbox />}>
    <Route index element={<InboxIndex />} />
    <Route path=":itemId" element={<InboxItem />} />
    <Route path="notices/:noticeId" element={<InboxNotice />} />
  </Route>
);

const meta = {
  title: 'Inbox/Items',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, OPENED_ITEM_ID)}>{routes}</StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={inboxPath(SLUG)} seed={emptyInbox}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, OPENED_ITEM_ID)} seed={failInbox}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, OPENED_ITEM_ID)} seed={seedInbox}>
      {routes}
    </StoryPage>
  ),
};

export const AwaitingApproval: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, APPROVAL_ITEM_ID)} seed={seedInbox}>
      {routes}
    </StoryPage>
  ),
};

export const Approved: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, APPROVAL_ITEM_ID)} seed={seedApproved}>
      {routes}
    </StoryPage>
  ),
};

export const Dismissed: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, APPROVAL_ITEM_ID)} seed={seedDismissed}>
      {routes}
    </StoryPage>
  ),
};

export const AwaitingConnection: Story = {
  render: () => (
    <StoryPage
      at={inboxItemPath(SLUG, CONNECTION_ITEM_ID)}
      seed={seedConnectionAsked}
    >
      {routes}
    </StoryPage>
  ),
};

export const Connected: Story = {
  render: () => (
    <StoryPage
      at={inboxItemPath(SLUG, CONNECTION_ITEM_ID)}
      seed={seedConnectionMet}
    >
      {routes}
    </StoryPage>
  ),
};

export const ProposedMemories: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, MEMORIES_ITEM_ID)} seed={seedInbox}>
      {routes}
    </StoryPage>
  ),
};

export const RepeatedFailure: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, FAILING_ITEM_ID)} seed={seedInbox}>
      {routes}
    </StoryPage>
  ),
};
