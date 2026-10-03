import type { Meta, StoryObj } from '@storybook/react-vite';
import { TokenCreated } from '@/components/features/tokens/TokenCreated';

const meta = {
  title: 'Settings/Workspace/Tokens/Token created',
  component: TokenCreated,
  parameters: { layout: 'padded' },
  args: {
    name: 'terraform',
    token: 'q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw',
    onDone: () => undefined,
  },
} satisfies Meta<typeof TokenCreated>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
