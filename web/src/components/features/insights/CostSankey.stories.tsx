import type { Meta, StoryObj } from '@storybook/react-vite';
import { CostSankey } from '@/components/features/insights/CostSankey';
import type { SankeyShown } from '@/lib/insights';

const shown: SankeyShown = {
  nodes: [
    { name: 'Harness default', kind: 'model' },
    { name: 'Coder', kind: 'station' },
    { name: 'Reviewer', kind: 'station' },
    {
      name: 'usespotlightai/terraform-aws-spotlight-runner-daytona',
      kind: 'repository',
    },
    { name: 'usespotlightai/spotlight', kind: 'repository' },
    { name: 'usespotlightai/docs', kind: 'repository' },
  ],
  links: [
    { source: 0, target: 1, value: 15.2 },
    { source: 0, target: 2, value: 3.98 },
    { source: 1, target: 3, value: 0.45 },
    { source: 1, target: 4, value: 14.75 },
    { source: 2, target: 5, value: 3.98 },
  ],
};

const meta = {
  title: 'Insights/CostSankey',
  component: CostSankey,
  args: { shown, currency: 'USD' },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CostSankey>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Wide: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 800 }}>
        <Story />
      </div>
    ),
  ],
};
