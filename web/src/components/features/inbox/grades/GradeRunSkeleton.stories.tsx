import type { Meta, StoryObj } from '@storybook/react-vite';

import { GradeRunSkeleton } from '@/components/features/inbox/grades/GradeRunSkeleton';

const meta = {
  title: 'Inbox/Grade card',
  component: GradeRunSkeleton,
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GradeRunSkeleton>;

export default meta;

export const Loading: StoryObj<typeof meta> = {};
