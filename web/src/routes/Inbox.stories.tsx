import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { inboxItemPath, inboxPath, noticePath } from '@/lib/inbox';
import { Inbox } from '@/routes/Inbox';
import { InboxIndex } from '@/routes/InboxIndex';
import { InboxItem } from '@/routes/InboxItem';
import { InboxNotice } from '@/routes/InboxNotice';
import {
  APPROVAL_ITEM_ID,
  emptyInbox,
  FAILING_ITEM_ID,
  failInbox,
  MEMORIES_ITEM_ID,
  NOTICE_ID,
  OPENED_ITEM_ID,
  SLUG,
  seedApproved,
  seedDismissed,
  seedInbox,
  seedSettledNotice,
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

export const SearchStalled: Story = {
  name: 'Search stalled notice',
  render: () => (
    <StoryPage at={noticePath(SLUG, NOTICE_ID)} seed={seedInbox}>
      {routes}
    </StoryPage>
  ),
};

export const NoticeDismissed: Story = {
  name: 'Dismissed notice',
  render: () => (
    <StoryPage at={noticePath(SLUG, NOTICE_ID)} seed={seedSettledNotice}>
      {routes}
    </StoryPage>
  ),
};

export const NoticeLoading: Story = {
  name: 'Notice loading',
  render: () => (
    <StoryPage at={noticePath(SLUG, NOTICE_ID)}>{routes}</StoryPage>
  ),
};

export const NoticeFailed: Story = {
  name: 'Notice error',
  render: () => (
    <StoryPage at={noticePath(SLUG, NOTICE_ID)} seed={failInbox}>
      {routes}
    </StoryPage>
  ),
};

export const NoticeGone: Story = {
  name: 'Notice gone',
  render: () => (
    <StoryPage at={noticePath(SLUG, NOTICE_ID)} seed={emptyInbox}>
      {routes}
    </StoryPage>
  ),
};
