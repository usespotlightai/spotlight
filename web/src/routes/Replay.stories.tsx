import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  choice,
  type PageArgs,
  pageStory,
  toggle,
} from '@/stories/application';

type ReplayArgs = {
  readonly replay: 'replay_shorter_prompt' | 'replay_live_4';
  readonly opened: boolean;
};

const meta = {
  title: 'Team/Lines/Replay',
  ...pageStory<ReplayArgs>({
    at: ({ replay }) =>
      `/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation/replays/${replay}`,
    args: { replay: 'replay_shorter_prompt', opened: false },
    argTypes: {
      replay: choice('Replay', {
        replay_shorter_prompt: 'Shorter prompt',
        replay_live_4: 'Baseline',
      }),
      opened: toggle('Opened task'),
    },
    script: ({ opened }) =>
      opened
        ? async (screen, user) => {
            const [first] = await screen.findAllByRole('button', {
              name: /^Details of /,
            });
            if (first) {
              await user.click(first);
            }
          }
        : undefined,
  }),
} satisfies Meta<PageArgs & ReplayArgs>;

export default meta;

export const Replay: StoryObj<typeof meta> = {};
