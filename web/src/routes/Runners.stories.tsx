import type { Meta, StoryObj } from '@storybook/react-vite';
import { runnersPath } from '@/lib/runner';
import { SLUG } from '@/mocks/world';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Settings/Workspace/Runners',
  ...pageStory({ at: runnersPath(SLUG) }),
} satisfies Meta<PageArgs>;

export default meta;

export const Runners: StoryObj<typeof meta> = {};
