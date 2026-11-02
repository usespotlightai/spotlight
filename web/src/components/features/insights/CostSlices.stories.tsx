import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { CostSlices } from '@/components/features/insights/CostSlices';

const repositories = Array.from({ length: 12 }, (_, at) => ({
  key: `acme/repository-${at}`,
  amount: 12 - at,
  share: (12 - at) / 78,
  runs: at + 1,
}));

const models = [
  { key: 'claude-sonnet-5-5', amount: 40, share: 0.8, runs: 30 },
  { key: 'claude-haiku-5-5', amount: 10, share: 0.2, runs: 12 },
];

const named = (_dimension: unknown, key: string | null) => key ?? '–';

const meta = {
  title: 'Insights/CostSlices',
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  render: () => (
    <>
      <CostSlices
        title="By model"
        dimension="model"
        slices={models}
        currency="USD"
        named={named}
      />
      <CostSlices
        title="By repository"
        dimension="repository"
        slices={repositories}
        currency="USD"
        named={named}
      />
    </>
  ),
} satisfies Meta;

export default meta;

export const EqualHeight: StoryObj<typeof meta> = {};
