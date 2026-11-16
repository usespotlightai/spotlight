import type { Meta, StoryObj } from '@storybook/react-vite';

import { inferenceSettingsPath } from '@/lib/settings';
import { SLUG } from '@/mocks/world';
import { inferenceEndpoint, settingsWorld } from '@/mocks/world/settings';
import { type PageArgs, pageStory } from '@/stories/application';

const AT = inferenceSettingsPath(SLUG);

const meta = {
  title: 'Settings/Workspace/Inference',
  ...pageStory({
    states: ['data', 'empty', 'loading', 'error'],
    at: AT,
  }),
} satisfies Meta<PageArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithData: Story = { name: 'With data' };

export const Empty: Story = { args: { state: 'empty' } };

export const Loading: Story = { args: { state: 'loading' } };

export const Failed: Story = { name: 'Error', args: { state: 'error' } };

export const CheckFailed: Story = {
  name: 'Check failed',
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
