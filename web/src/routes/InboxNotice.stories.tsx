import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { noticePath } from '@/lib/inbox';
import { InboxNotice } from '@/routes/InboxNotice';
import {
  emptyInbox,
  failInbox,
  NOTICE_ID,
  SLUG,
  seedInbox,
  seedSettledNotice,
} from '@/stories/fixtures/inbox';
import { StoryPage } from '@/stories/StoryPage';

function Showing({ seed }: { seed?: (client: QueryClient) => void }) {
  return (
    <StoryPage at={noticePath(SLUG, NOTICE_ID)} seed={seed}>
      <Route
        path="/w/:slug/inbox/notices/:noticeId"
        element={<InboxNotice />}
      />
    </StoryPage>
  );
}

const meta = {
  title: 'Inbox/Notices',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <Showing />,
};

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={failInbox} />,
};

export const WithData: Story = {
  render: () => <Showing seed={seedInbox} />,
};

export const Read: Story = {
  render: () => <Showing seed={seedSettledNotice} />,
};

export const Gone: Story = {
  render: () => <Showing seed={emptyInbox} />,
};
