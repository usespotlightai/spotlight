import type { Meta, StoryObj } from '@storybook/react-vite';

import { memoryUpkeepPath } from '@/lib/memory-upkeep';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { UPKEEP_ID } from '@/mocks/world/memory-upkeeps';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Team/Memory/Upkeep',
  ...pageStory({
    at: () => memoryUpkeepPath(SLUG, PLATFORM_ID, UPKEEP_ID),
  }),
} satisfies Meta<PageArgs>;

export default meta;

export const Upkeep: StoryObj<typeof meta> = {};
