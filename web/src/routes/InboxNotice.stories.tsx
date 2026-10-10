import type { Meta, StoryObj } from '@storybook/react-vite';
import { noticePath } from '@/lib/inbox';
import { SLUG } from '@/mocks/world';
import { FINISHED_NOTICE_ID, STALLED_NOTICE_ID } from '@/mocks/world/inbox';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type NoticeArgs = {
  readonly notice: string;
};

const meta = {
  title: 'Inbox/Notices',
  ...pageStory<NoticeArgs>({
    at: ({ notice }) => noticePath(SLUG, notice),
    args: { notice: STALLED_NOTICE_ID },
    argTypes: {
      notice: choice('Notice', {
        [STALLED_NOTICE_ID]: 'Unread',
        [FINISHED_NOTICE_ID]: 'Read',
      }),
    },
  }),
} satisfies Meta<PageArgs & NoticeArgs>;

export default meta;

export const Notices: StoryObj<typeof meta> = {};
