import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { replaySetPath } from '@/lib/replay';
import { ReplaySet } from '@/routes/ReplaySet';
import {
  EMPTY_SET_ID,
  failReplaySet,
  failReplaySetChecks,
  LINE_ID,
  SET_ID,
  SLUG,
  STATION_ID,
  seedEmptyReplaySet,
  seedGoneReplaySet,
  seedLopsidedReplaySet,
  seedReplaySet,
  seedReplaySetAwaiting,
  seedReplaySetChecksAwaiting,
  seedReplaySetHealthPending,
  seedReplaySetSanityUncompared,
  seedReplaySetWithNoise,
  seedUnhealthyReplaySet,
  TEAM_ID,
} from '@/stories/fixtures/replays';
import { StoryPage } from '@/stories/StoryPage';

const place = {
  slug: SLUG,
  teamId: TEAM_ID,
  lineId: LINE_ID,
  stationId: STATION_ID,
};
const at = replaySetPath(place, SET_ID);

const routes = (
  <Route
    path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId/replay-sets/:setId"
    element={<ReplaySet />}
  />
);

const meta = {
  title: 'Team/Lines/Replay set',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={seedReplaySetAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage
      at={replaySetPath(place, EMPTY_SET_ID)}
      seed={seedEmptyReplaySet}
    >
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failReplaySet}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedReplaySet}>
      {routes}
    </StoryPage>
  ),
};

export const NoiseMeasured: Story = {
  name: 'Noise measured',
  render: () => (
    <StoryPage at={at} seed={seedReplaySetWithNoise}>
      {routes}
    </StoryPage>
  ),
};

export const Unhealthy: Story = {
  render: () => (
    <StoryPage at={at} seed={seedUnhealthyReplaySet}>
      {routes}
    </StoryPage>
  ),
};

export const HealthPending: Story = {
  name: 'Health being read',
  render: () => (
    <StoryPage at={at} seed={seedReplaySetHealthPending}>
      {routes}
    </StoryPage>
  ),
};

export const SanityUncompared: Story = {
  name: 'Stronger model could not be compared',
  render: () => (
    <StoryPage at={at} seed={seedReplaySetSanityUncompared}>
      {routes}
    </StoryPage>
  ),
};

export const StationGone: Story = {
  name: 'Station gone',
  render: () => (
    <StoryPage at={at} seed={seedGoneReplaySet}>
      {routes}
    </StoryPage>
  ),
};

export const ChecksLoading: Story = {
  name: 'Checks loading',
  render: () => (
    <StoryPage at={at} seed={seedReplaySetChecksAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const ChecksFailed: Story = {
  name: 'Checks error',
  render: () => (
    <StoryPage at={at} seed={failReplaySetChecks}>
      {routes}
    </StoryPage>
  ),
};

export const Lopsided: Story = {
  render: () => (
    <StoryPage at={at} seed={seedLopsidedReplaySet}>
      {routes}
    </StoryPage>
  ),
};
