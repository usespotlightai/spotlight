import type { Meta, StoryObj } from '@storybook/react-vite';

import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Team/Runs/Change stack/Public',
  ...pageStory({
    states: ['data', 'loading', 'error'],
    at: '/w/acme/team/team_platform/runs/run_postgres_2/changes?layer=c1.l2',
    args: { account: 'signed-out' as PageArgs['account'] },
  }),
} satisfies Meta<PageArgs>;

export default meta;

export const Public: StoryObj<typeof meta> = { name: 'Public' };
