import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ApprovalCard } from '@/components/features/inbox/conversation/approval/ApprovalCard';
import type { Approval } from '@/lib/approval';

const COMMENT: Approval = {
  kind: 'tool-call',
  name: 'linear.comment',
  because: 'It posts publicly on the issue, under the team’s name.',
  inputs: [
    {
      name: 'body',
      value:
        'Drained webhook-retries: 1,201 jobs replayed. Three endpoints are gone for good and have been dropped.',
    },
    { name: 'issue', value: 'ENG-412' },
  ],
  standing: 'asked',
  edited: null,
  intent: 'post the drain summary on the issue, publicly under the team’s name',
};

const LOGS: Approval = {
  kind: 'harness-permission',
  name: 'claude-code execute',
  because: 'The sre harness profile says to ask a person first.',
  inputs: [
    {
      name: 'title',
      value: 'kubectl logs deploy/api -n production --since=1h | grep -i error',
    },
  ],
  standing: 'asked',
  edited: null,
  intent: null,
};

const meta = {
  title: 'Inbox/Approvals',
  component: ApprovalCard,
  args: { approval: COMMENT, pending: false, onDecide: fn() },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApprovalCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Comment: Story = { name: 'A comment to post' };

export const Command: Story = {
  name: 'A command to run',
  args: { approval: LOGS },
};

export const Deciding: Story = {
  name: 'Being decided',
  args: { pending: true },
};

export const Edited: Story = {
  name: 'Approved with changes',
  args: {
    approval: {
      ...COMMENT,
      standing: 'granted',
      edited: [
        {
          name: 'body',
          value:
            'Drained webhook-retries: 1,201 jobs replayed. Three dead endpoints were dropped; owners are notified.',
        },
        { name: 'issue', value: 'ENG-412' },
      ],
    },
  },
};

export const Refused: Story = {
  name: 'Dismissed',
  args: { approval: { ...LOGS, standing: 'refused' } },
};
