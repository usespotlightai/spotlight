import type { Meta, StoryObj } from '@storybook/react-vite';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Application',
  ...pageStory({ at: '/' }),
} satisfies Meta<PageArgs>;

export default meta;

export const Application: StoryObj<typeof meta> = {};
