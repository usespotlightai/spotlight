import type { Meta, StoryObj } from '@storybook/react-vite';
import { IntegrationDescribedSource } from '@/components/features/integrations/IntegrationDescribedSource';

const HOURS_AGO = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const meta = {
  title: 'Settings/Team/Integration description',
  component: IntegrationDescribedSource,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IntegrationDescribedSource>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Read: Story = {
  args: {
    described: {
      kind: 'openapi',
      tools: 19,
      readAt: HOURS_AGO(3),
      problem: null,
    },
  },
};

export const OneTool: Story = {
  name: 'One tool',
  args: {
    described: {
      kind: 'graphql',
      tools: 1,
      readAt: HOURS_AGO(0.2),
      problem: null,
    },
  },
};

export const CouldNotBeRead: Story = {
  name: 'Could not be read',
  args: {
    described: {
      kind: 'openapi',
      tools: 0,
      readAt: HOURS_AGO(0.1),
      problem: 'could not be read: billing.example answered 404',
    },
  },
};
