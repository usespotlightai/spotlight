import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { searchPath } from '@/lib/search';
import { Search } from '@/routes/Search';
import {
  failSearch,
  LINE_ID,
  SEARCH_ID,
  SLUG,
  STATION_ID,
  seedCostSearch,
  seedSearch,
  seedSearchAwaiting,
  seedSeedingSearch,
  TEAM_ID,
} from '@/stories/fixtures/searches';
import { StoryPage } from '@/stories/StoryPage';

const at = searchPath(
  { slug: SLUG, teamId: TEAM_ID, lineId: LINE_ID, stationId: STATION_ID },
  SEARCH_ID,
);

const routes = (
  <Route
    path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId/searches/:searchId"
    element={<Search />}
  />
);

const meta = {
  title: 'Team/Lines/Search',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={seedSearchAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={seedSeedingSearch}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failSearch}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedSearch}>
      {routes}
    </StoryPage>
  ),
};

export const AimsForCost: Story = {
  name: 'Aims for the same success for less',
  render: () => (
    <StoryPage at={at} seed={seedCostSearch}>
      {routes}
    </StoryPage>
  ),
};
