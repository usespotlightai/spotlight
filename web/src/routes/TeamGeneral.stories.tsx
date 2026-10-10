import type { Meta, StoryObj } from '@storybook/react-vite';
import { teamSettingsPath } from '@/lib/settings';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Settings/Team/General',
  ...pageStory({
    states: ['data', 'loading', 'error'],
    at: teamSettingsPath(SLUG, PLATFORM_ID, 'general'),
  }),
} satisfies Meta<PageArgs>;

export default meta;

export const General: StoryObj<typeof meta> = {};
