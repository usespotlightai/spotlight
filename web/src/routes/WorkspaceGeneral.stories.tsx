import type { Meta, StoryObj } from '@storybook/react-vite';

import { workspaceGeneralPath } from '@/lib/settings';
import { SLUG } from '@/mocks/world';
import { inferenceEndpoint, settingsWorld } from '@/mocks/world/settings';
import { type PageArgs, pageStory } from '@/stories/application';

const AT = workspaceGeneralPath(SLUG);

const meta = {
  title: 'Settings/Workspace/General',
  ...pageStory({
    states: ['data', 'empty', 'loading', 'error'],
    at: AT,
  }),
} satisfies Meta<PageArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const General: Story = {};

export const NoInferenceEndpoint: Story = {
  name: 'No inference endpoint',
  args: { state: 'empty' },
};

export const InferenceCheckFailed: Story = {
  name: 'Inference check failed',
  ...pageStory({
    at: AT,
    world: () => {
      settingsWorld().inferenceEndpoints = [
        inferenceEndpoint({ baseUrl: 'https://no-credits.example/v1' }),
      ];
    },
  }),
};

export const ForAMember: Story = {
  name: 'For a member',
  args: { account: 'member' },
};
