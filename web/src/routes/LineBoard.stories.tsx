import type { Meta, StoryObj } from '@storybook/react-vite';

import { MAYA } from '@/mocks/world/people';
import { takenOverBy } from '@/mocks/world/takeovers';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type LineBoardArgs = {
  readonly line: 'line_delivery' | 'line_incidents';
  readonly takeover: 'none' | 'taken';
};

const meta = {
  title: 'Team/Lines/Board',
  ...pageStory<LineBoardArgs>({
    at: ({ line }) => `/w/acme/team/team_platform/lines/${line}`,
    args: { line: 'line_delivery', takeover: 'none' },
    argTypes: {
      line: choice('Line', {
        line_delivery: 'Delivery',
        line_incidents: 'Incidents',
      }),
      takeover: choice('Takeover', {
        none: 'Nothing taken over',
        taken: 'A task taken over',
      }),
    },
    world: ({ takeover }) => {
      if (takeover === 'taken') {
        takenOverBy('team_platform', 'task_retries', MAYA);
      }
    },
  }),
} satisfies Meta<PageArgs & LineBoardArgs>;

export default meta;

export const Board: StoryObj<typeof meta> = {};

export const TakenOver: StoryObj<typeof meta> = {
  args: { takeover: 'taken' },
};
