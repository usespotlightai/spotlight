import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { stationPath } from '@/lib/station';
import { Station } from '@/routes/Station';
import {
  failStation,
  failStationOutcomes,
  LINE_ID,
  refuseStationOutcomes,
  STATION_ID,
  seedStation,
  seedStationAwaitingOutcomes,
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
