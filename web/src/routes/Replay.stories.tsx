import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { replayPath } from '@/lib/replay';
import { Replay } from '@/routes/Replay';
import {
  BASELINE_ID,
  failReplay,
  LINE_ID,
  REPLAY_ID,
  SLUG,
  STATION_ID,
  seedBaselineReplay,
  seedEmptyReplay,
  seedReplay,
  seedReplayAwaiting,
  TEAM_ID,
} from '@/stories/fixtures/replays';
import { StoryPage } from '@/stories/StoryPage';

const place = {
  slug: SLUG,
  teamId: TEAM_ID,
  lineId: LINE_ID,
  stationId: STATION_ID,
};
const at = replayPath(place, REPLAY_ID);

const routes = (
  <Route
    path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId/replays/:replayId"
    element={<Replay />}
  />
);

const meta = {
  title: 'Team/Lines/Replay',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={seedReplayAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={seedEmptyReplay}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failReplay}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedReplay}>
      {routes}
    </StoryPage>
  ),
};

export const TaskDetails: Story = {
  name: 'Task details',
  render: () => (
    <StoryPage at={at} seed={seedReplay}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    const [first] = await canvas.findAllByRole('button', {
      name: /^Details of /,
    });
    if (first) {
      await userEvent.click(first);
    }
  },
};

export const Baseline: Story = {
  render: () => (
    <StoryPage at={replayPath(place, BASELINE_ID)} seed={seedBaselineReplay}>
      {routes}
    </StoryPage>
  ),
};
