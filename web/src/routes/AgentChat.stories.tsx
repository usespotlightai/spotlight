import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

const chats = '/w/acme/team/team_platform/agent';

type ChatArgs = {
  readonly chat: string;
};

const meta = {
  title: 'Team/Agent/Chat',
  ...pageStory<ChatArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ chat }) => `${chats}/${chat}`,
    args: { chat: 'chat_retries' },
    argTypes: {
      chat: choice('Chat', {
        chat_retries: 'Planning tasks',
        chat_small_prs: 'Improving a station',
        chat_pasted_log: 'Long message',
      }),
    },
  }),
} satisfies Meta<PageArgs & ChatArgs>;

export default meta;

export const Chat: StoryObj<typeof meta> = {};

export const Repositories: StoryObj<typeof meta> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Repositories' }),
    );
  },
};

export const LongMessage: StoryObj<typeof meta> = {
  args: { chat: 'chat_pasted_log' },
};
