import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type LineBoardArgs = {
  readonly line: 'line_delivery' | 'line_incidents';
};

const meta = {
  title: 'Team/Lines/Board',
  ...pageStory<LineBoardArgs>({
    at: ({ line }) => `/w/acme/team/team_platform/lines/${line}`,
    args: { line: 'line_delivery' },
    argTypes: {
      line: choice('Line', {
        line_delivery: 'Delivery',
        line_incidents: 'Incidents',
      }),
    },
  }),
} satisfies Meta<PageArgs & LineBoardArgs>;

export default meta;

export const Board: StoryObj<typeof meta> = {};
