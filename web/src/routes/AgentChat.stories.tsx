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
        chat_long_proposal: 'Long proposal',
        chat_long: 'Long conversation',
        chat_steps_unloaded: 'Older steps still loading',
        chat_proposal_states: 'Every proposal state',
        chat_setting_up: 'Setting up the workspace',
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

export const LongProposal: StoryObj<typeof meta> = {
  args: { chat: 'chat_long_proposal' },
};

export const LongConversation: StoryObj<typeof meta> = {
  args: { chat: 'chat_long' },
};

export const ProposalStates: StoryObj<typeof meta> = {
  args: { chat: 'chat_proposal_states' },
};

export const ReplacedProposalOpened: StoryObj<typeof meta> = {
  args: { chat: 'chat_proposal_states' },
  play: async ({ canvas, userEvent }) => {
    const [replaced] = await canvas.findAllByRole('button', {
      name: 'Show the proposal',
    });
    await userEvent.click(replaced);
  },
};

export const ProposalRestored: StoryObj<typeof meta> = {
  args: { chat: 'chat_proposal_states' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Restore Log every rejected webhook',
      }),
    );
    await canvas.findAllByRole('button', { name: 'Dismiss' });
  },
};

export const SettingUp: StoryObj<typeof meta> = {
  args: { chat: 'chat_setting_up' },
};

export const StepsLoading: StoryObj<typeof meta> = {
  args: { chat: 'chat_steps_unloaded' },
  play: async ({ canvas, userEvent }) => {
    const summaries = await canvas.findAllByRole('button', {
      name: /Worked/,
      expanded: false,
    });
    await userEvent.click(summaries[1]);
    await canvas.findByText(/Loading/);
  },
};
