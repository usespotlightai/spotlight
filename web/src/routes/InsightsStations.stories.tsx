import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import {
  emptyStations,
  failStations,
  insightsAt,
  loadInsights,
  seedStations,
} from '@/stories/fixtures/insights';
import { seedCandidates } from '@/stories/fixtures/insights-candidates';
import {
  seedChanges,
  seedStationChanges,
} from '@/stories/fixtures/insights-changes';
import {
  failStationJudge,
  failStationOutcomes,
  refuseStationJudge,
  STATION_ID,
  seedStation,
  seedStationClaimsJudge,
  seedStationJudgeEmpty,
  seedStationWithoutRuns,
} from '@/stories/fixtures/station';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('stations');

const alongside =
  (seed: (client: QueryClient) => void) => (client: QueryClient) => {
    seedChanges(client);
    seedCandidates(client);
    seed(client);
  };

const stationAt = `${at}&stationId=${STATION_ID}`;

const withStations =
  (seed: (client: QueryClient) => void) => (client: QueryClient) => {
    seedStations(client);
    seedStationChanges(client);
    seed(client);
  };

const meta = {
  title: 'Team/Insights/Stations/By station',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(loadInsights)}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(emptyStations)}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={alongside(failStations)}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(seedStations)}>
      {routes}
    </StoryPage>
  ),
};

export const Station: Story = {
  name: 'One station',
  render: () => (
    <StoryPage at={stationAt} seed={withStations(seedStation)}>
      {routes}
    </StoryPage>
  ),
};

export const StationJudgeByClaims: Story = {
  name: 'One station judge by claims',
  render: () => (
    <StoryPage at={stationAt} seed={withStations(seedStationClaimsJudge)}>
      {routes}
    </StoryPage>
  ),
};

export const StationJudgeEmpty: Story = {
  name: 'One station judge empty',
  render: () => (
    <StoryPage at={stationAt} seed={withStations(seedStationJudgeEmpty)}>
      {routes}
    </StoryPage>
  ),
};

export const StationJudgeFailed: Story = {
  name: 'One station judge error',
  render: () => (
    <StoryPage at={stationAt} seed={withStations(failStationJudge)}>
      {routes}
    </StoryPage>
  ),
};

export const StationJudgeMembersOnly: Story = {
  name: 'One station judge members only',
  render: () => (
    <StoryPage at={stationAt} seed={withStations(refuseStationJudge)}>
      {routes}
    </StoryPage>
  ),
};

export const StationRunsEmpty: Story = {
  name: 'One station runs empty',
  render: () => (
    <StoryPage at={stationAt} seed={withStations(seedStationWithoutRuns)}>
      {routes}
    </StoryPage>
  ),
};

export const StationRunsFailed: Story = {
  name: 'One station runs error',
  render: () => (
    <StoryPage at={stationAt} seed={withStations(failStationOutcomes)}>
      {routes}
    </StoryPage>
  ),
};
