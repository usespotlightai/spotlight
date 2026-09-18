import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { Inbox } from '@/routes/Inbox';
import { InboxIndex } from '@/routes/InboxIndex';
import { InboxItem } from '@/routes/InboxItem';
import {
  APPROVAL_ITEM_ID,
  emptyInbox,
  failInbox,
  OPENED_ITEM_ID,
  SLUG,
  seedApproved,
  seedInbox,
  seedRejected,
} from '@/stories/fixtures/inbox';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/inbox" element={<Inbox />}>
    <Route index element={<InboxIndex />} />
    <Route path=":itemId" element={<InboxItem />} />
  </Route>
);

const meta = {
  title: 'Pages/Inbox',
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

export const Rejected: Story = {
  render: () => (
    <StoryPage at={inboxItemPath(SLUG, APPROVAL_ITEM_ID)} seed={seedRejected}>
      {routes}
    </StoryPage>
  ),
};
