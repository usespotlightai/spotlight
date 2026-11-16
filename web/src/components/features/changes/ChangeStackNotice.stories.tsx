import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChangeStackNotice } from '@/components/features/changes/ChangeStackNotice';
import { SLUG } from '@/mocks/world';
import { inWorkspace } from '@/stories/inference';

const meta = {
  title: 'Team/Runs/Change stack/No inference endpoint',
  component: ChangeStackNotice,
  args: {
    slug: SLUG,
    stack: null,
    back: { to: `/w/${SLUG}`, label: 'Back to the run' },
  },
  decorators: [inWorkspace('unset')],
} satisfies Meta<typeof ChangeStackNotice>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
