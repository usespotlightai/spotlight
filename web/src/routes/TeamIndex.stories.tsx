import type { Meta, StoryObj } from '@storybook/react-vite';
import { teamPath } from '@/lib/team';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Team/Landing',
  ...pageStory({ at: teamPath(SLUG, PLATFORM_ID), scope: 'app' }),
} satisfies Meta<PageArgs>;

export default meta;

export const Landing: StoryObj<typeof meta> = {};
