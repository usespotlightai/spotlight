import type { Meta, StoryObj } from '@storybook/react-vite';

import { NoMcpServers } from '@/components/features/insights/tools/NoMcpServers';

const meta = {
  title: 'Insights/NoMcpServers',
  component: NoMcpServers,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoMcpServers>;

export default meta;

export const Empty: StoryObj<typeof meta> = {};
