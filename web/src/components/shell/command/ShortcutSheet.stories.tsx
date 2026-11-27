import type { Meta, StoryObj } from '@storybook/react-vite';

import { ShortcutSheet } from '@/components/shell/command/ShortcutSheet';

const meta = {
  title: 'Shell/ShortcutSheet',
  component: ShortcutSheet,
  args: {
    open: true,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof ShortcutSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
