import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { stationTabPath } from '@/lib/station';
import { Station } from '@/routes/Station';
import {
  failStationReplays,
  refuseStationReplays,
  seedStationReplays,
  seedStationReplaysAwaiting,
  seedStationWithoutReplays,
} from '@/stories/fixtures/replays';
import {
  failStationSearches,
  refuseStationSearches,
  seedStationSearches,
  seedStationSearchesAwaiting,
  seedStationWithoutSearches,
} from '@/stories/fixtures/searches';
import {
  failStation,
  failStationOutcomes,
  LINE_ID,
  refuseStationOutcomes,
  STATION_ID,
  seedStationAwaitingOutcomes,
  seedStationClaimsJudge,
  seedStationJudgeAwaiting,
  seedStationJudgeHidden,
  seedStationWithoutRuns,
} from '@/stories/fixtures/station';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';
import { StoryPage } from '@/stories/StoryPage';

const at = stationTabPath(SLUG, TEAM_ID, LINE_ID, STATION_ID, 'overview');
const improve = stationTabPath(SLUG, TEAM_ID, LINE_ID, STATION_ID, 'improve');
const config = stationTabPath(SLUG, TEAM_ID, LINE_ID, STATION_ID, 'config');

const routes = (
  <Route
    path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId/:tab?"
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
  name: 'Overview',
  render: () => (
    <StoryPage at={at} seed={seedStationSearches}>
      {routes}
    </StoryPage>
  ),
};

export const Improve: Story = {
  render: () => (
    <StoryPage at={improve} seed={seedStationSearches}>
      {routes}
    </StoryPage>
  ),
};

export const Config: Story = {
  render: () => (
    <StoryPage at={config} seed={seedStationSearches}>
      {routes}
    </StoryPage>
  ),
};

export const ConfigJudgeByClaims: Story = {
  name: 'Config judge by claims',
  render: () => (
    <StoryPage at={config} seed={seedStationClaimsJudge}>
      {routes}
    </StoryPage>
  ),
};

export const RunsLoading: Story = {
  name: 'Recent runs loading',
  render: () => (
    <StoryPage at={at} seed={seedStationAwaitingOutcomes}>
      {routes}
    </StoryPage>
  ),
};

export const RunsEmpty: Story = {
  name: 'Recent runs empty',
  render: () => (
    <StoryPage at={at} seed={seedStationWithoutRuns}>
      {routes}
    </StoryPage>
  ),
};

export const RunsFailed: Story = {
  name: 'Recent runs error',
  render: () => (
    <StoryPage at={at} seed={failStationOutcomes}>
      {routes}
    </StoryPage>
  ),
};

export const RunsMembersOnly: Story = {
  name: 'Recent runs members only',
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
    <StoryPage at={improve} seed={seedStationReplaysAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const ReplaysEmpty: Story = {
  name: 'Replays empty',
  render: () => (
    <StoryPage at={improve} seed={seedStationWithoutReplays}>
      {routes}
    </StoryPage>
  ),
};

export const ReplaysFailed: Story = {
  name: 'Replays error',
  render: () => (
    <StoryPage at={improve} seed={failStationReplays}>
      {routes}
    </StoryPage>
  ),
};

export const ReplaysMembersOnly: Story = {
  name: 'Replays members only',
  render: () => (
    <StoryPage at={improve} seed={refuseStationReplays}>
      {routes}
    </StoryPage>
  ),
};

export const Replays: Story = {
  name: 'Replays',
  render: () => (
    <StoryPage at={improve} seed={seedStationReplays}>
      {routes}
    </StoryPage>
  ),
};

export const SearchesLoading: Story = {
  name: 'Searches loading',
  render: () => (
    <StoryPage at={improve} seed={seedStationSearchesAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const SearchesEmpty: Story = {
  name: 'Searches empty',
  render: () => (
    <StoryPage at={improve} seed={seedStationWithoutSearches}>
      {routes}
    </StoryPage>
  ),
};

export const SearchesFailed: Story = {
  name: 'Searches error',
  render: () => (
    <StoryPage at={improve} seed={failStationSearches}>
      {routes}
    </StoryPage>
  ),
};

export const SearchesMembersOnly: Story = {
  name: 'Searches members only',
  render: () => (
    <StoryPage at={improve} seed={refuseStationSearches}>
      {routes}
    </StoryPage>
  ),
};

export const Searches: Story = {
  name: 'Searches',
  render: () => (
    <StoryPage at={improve} seed={seedStationSearches}>
      {routes}
    </StoryPage>
  ),
};
