import type { Meta, StoryObj } from '@storybook/react-vite';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Team/Runs/All runs',
  ...pageStory({ at: '/w/acme/team/team_platform/runs' }),
} satisfies Meta<PageArgs>;

export default meta;

export const AllRuns: StoryObj<typeof meta> = { name: 'All runs' };
