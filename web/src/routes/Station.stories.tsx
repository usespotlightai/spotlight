import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { stationPath } from '@/lib/station';
import { Station } from '@/routes/Station';
import {
  failStationReplays,
  refuseStationReplays,
  seedStationReplays,
  seedStationReplaysAwaiting,
  seedStationWithoutReplays,
} from '@/stories/fixtures/replays';
import {
  failStation,
  failStationJudge,
  failStationOutcomes,
  LINE_ID,
  refuseStationJudge,
  refuseStationOutcomes,
  STATION_ID,
  seedStation,
  seedStationAwaitingOutcomes,
  seedStationJudgeAwaiting,
  seedStationJudgeEmpty,
  seedStationJudgeHidden,
  seedStationWithoutRuns,
} from '@/stories/fixtures/station';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';
import { StoryPage } from '@/stories/StoryPage';

const at = stationPath(SLUG, TEAM_ID, LINE_ID, STATION_ID);

const routes = (
  <Route
    path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId"
    element={<Station />}
  />
);

const meta = {
  title: 'Team/Lines/Station',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failStation}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedStation}>
      {routes}
    </StoryPage>
  ),
};

export const RunsLoading: Story = {
  name: 'Runs loading',
  render: () => (
    <StoryPage at={at} seed={seedStationAwaitingOutcomes}>
      {routes}
    </StoryPage>
  ),
};

export const RunsEmpty: Story = {
  name: 'Runs empty',
  render: () => (
    <StoryPage at={at} seed={seedStationWithoutRuns}>
      {routes}
    </StoryPage>
  ),
};

export const RunsFailed: Story = {
  name: 'Runs error',
  render: () => (
    <StoryPage at={at} seed={failStationOutcomes}>
      {routes}
    </StoryPage>
  ),
};

export const RunsMembersOnly: Story = {
  name: 'Runs members only',
  render: () => (
    <StoryPage at={at} seed={refuseStationOutcomes}>
      {routes}
    </StoryPage>
  ),
};

export const JudgeLoading: Story = {
  name: 'Judge loading',
  render: () => (
    <StoryPage at={at} seed={seedStationJudgeAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const JudgeEmpty: Story = {
  name: 'Judge empty',
  render: () => (
    <StoryPage at={at} seed={seedStationJudgeEmpty}>
      {routes}
    </StoryPage>
  ),
};

export const JudgeFailed: Story = {
  name: 'Judge error',
  render: () => (
    <StoryPage at={at} seed={failStationJudge}>
      {routes}
    </StoryPage>
  ),
};

export const JudgeMembersOnly: Story = {
  name: 'Judge members only',
  render: () => (
    <StoryPage at={at} seed={refuseStationJudge}>
      {routes}
    </StoryPage>
  ),
};

export const JudgeHidden: Story = {
  name: 'Judge hidden',
  render: () => (
    <StoryPage at={at} seed={seedStationJudgeHidden}>
      {routes}
    </StoryPage>
  ),
};

export const ReplaysLoading: Story = {
  name: 'Replays loading',
  render: () => (
    <StoryPage at={at} seed={seedStationReplaysAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const ReplaysEmpty: Story = {
  name: 'Replays empty',
  render: () => (
    <StoryPage at={at} seed={seedStationWithoutReplays}>
      {routes}
    </StoryPage>
  ),
};

export const ReplaysFailed: Story = {
  name: 'Replays error',
  render: () => (
    <StoryPage at={at} seed={failStationReplays}>
      {routes}
    </StoryPage>
  ),
};

export const ReplaysMembersOnly: Story = {
  name: 'Replays members only',
  render: () => (
    <StoryPage at={at} seed={refuseStationReplays}>
      {routes}
    </StoryPage>
  ),
};

export const Replays: Story = {
  name: 'Replays',
  render: () => (
    <StoryPage
      at={{ pathname: at, hash: '#replays' }}
      seed={seedStationReplays}
    >
      {routes}
    </StoryPage>
  ),
};
