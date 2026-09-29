import type { Meta, StoryObj } from '@storybook/react-vite';
import { PoolCreated } from '@/components/features/runners/PoolCreated';

const meta = {
  title: 'Workspace/Runners/Pool created',
  component: PoolCreated,
  parameters: { layout: 'padded' },
  args: {
    pool: 'my-computer',
    token: 'spt_3f9a2c7e1b4d58f6e0c1a2b3d4e5f607a8b9c0d1e2f3a4b5',
  },
} satisfies Meta<typeof PoolCreated>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
