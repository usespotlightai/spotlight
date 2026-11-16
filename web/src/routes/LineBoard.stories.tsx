import type { Meta, StoryObj } from '@storybook/react-vite';

import { onHoldBy } from '@/mocks/world/holds';
import { MAYA } from '@/mocks/world/people';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type LineBoardArgs = {
  readonly line: 'line_delivery' | 'line_incidents';
  readonly hold: 'none' | 'taken';
};

const meta = {
  title: 'Team/Lines/Board',
  ...pageStory<LineBoardArgs>({
    at: ({ line }) => `/w/acme/team/team_platform/lines/${line}`,
    args: { line: 'line_delivery', hold: 'none' },
    argTypes: {
      line: choice('Line', {
        line_delivery: 'Delivery',
        line_incidents: 'Incidents',
      }),
      hold: choice('Hold', {
        none: 'Nothing on hold',
        taken: 'A task on hold',
      }),
    },
    world: ({ hold }) => {
      if (hold === 'taken') {
        onHoldBy('team_platform', 'task_retries', MAYA);
      }
    },
  }),
} satisfies Meta<PageArgs & LineBoardArgs>;

export default meta;

export const Board: StoryObj<typeof meta> = {};

export const Held: StoryObj<typeof meta> = {
  args: { hold: 'taken' },
};
