import type { Meta, StoryObj } from '@storybook/react-vite';

import { AnswerFailed } from '@/components/features/changes/AnswerFailed';
import { withSentRequest } from '@/lib/request-failure';
import { inWorkspace } from '@/stories/inference';

const failedWith = (status: number) =>
  withSentRequest(
    {},
    { status } as Response,
    new Request('http://localhost/answers', { method: 'POST' }),
  );

const meta = {
  title: 'Team/Runs/Change stack/Answer failed',
  component: AnswerFailed,
  args: { error: failedWith(502) },
} satisfies Meta<typeof AnswerFailed>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InsufficientCredits: Story = {
  name: 'Insufficient credits',
  args: { error: failedWith(402) },
  decorators: [inWorkspace('set')],
};

export const OtherFailure: Story = {
  name: 'Other failure',
  decorators: [inWorkspace('set')],
};

export const NoEndpoint: Story = {
  name: 'No endpoint',
  decorators: [inWorkspace('unset')],
};
