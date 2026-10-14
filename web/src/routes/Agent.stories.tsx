import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

const AT = '/w/acme/team/team_platform/agent';

const ARRIVALS = {
  traces: {
    traces: [
      { taskId: 'task_retries', title: 'Drain the stuck retry queues' },
      {
        taskId: 'task_billing',
        title: 'Reconcile open invoices after the retry drain',
      },
    ],
  },
  improving: {
    improving: {
      lineId: 'line_delivery',
      lineKey: 'delivery',
      lineName: 'Delivery',
      stationId: 'station_implementation',
      stationKey: 'implementation',
      stationName: 'Implementation',
    },
  },
};

type ChatsArgs = {
  readonly arrival: 'none' | keyof typeof ARRIVALS;
};

const meta = {
  title: 'Team/Agent/Chats',
  ...pageStory<ChatsArgs>({
    at: ({ arrival }) =>
      arrival === 'none' ? AT : { pathname: AT, state: ARRIVALS[arrival] },
    args: { arrival: 'none' },
    argTypes: {
      arrival: choice('Opened with', {
        none: 'Nothing',
        traces: 'Sharing traces',
        improving: 'Improving a station',
      }),
    },
  }),
} satisfies Meta<PageArgs & ChatsArgs>;

export default meta;

export const Chats: StoryObj<typeof meta> = {};
