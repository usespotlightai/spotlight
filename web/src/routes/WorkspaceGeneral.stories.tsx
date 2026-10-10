import type { Meta, StoryObj } from '@storybook/react-vite';
import { workspaceGeneralPath } from '@/lib/settings';
import { SLUG } from '@/mocks/world';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Settings/Workspace/General',
  ...pageStory({
    states: ['data', 'loading', 'error'],
    at: workspaceGeneralPath(SLUG),
  }),
} satisfies Meta<PageArgs>;

export default meta;

export const General: StoryObj<typeof meta> = {};
