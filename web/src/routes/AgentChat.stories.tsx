import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

const chats = '/w/acme/team/team_platform/agent';

type ChatArgs = {
  readonly chat: string;
};

const meta = {
  title: 'Team/Agent/Chat',
  ...pageStory<ChatArgs>({
    at: ({ chat }) => `${chats}/${chat}`,
    args: { chat: 'chat_retries' },
    argTypes: {
      chat: choice('Chat', {
        chat_retries: 'Planning tasks',
        chat_small_prs: 'Improving a station',
      }),
    },
  }),
} satisfies Meta<PageArgs & ChatArgs>;

export default meta;

export const Chat: StoryObj<typeof meta> = {};
