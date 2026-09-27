import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamSectionPath } from '@/lib/team';
import { TeamSection } from '@/routes/TeamSection';
import {
  emptyTeamMemory,
  FOCUSED_ID,
  failTeamMemory,
  loadTeamMemory,
  MISSING_ID,
  SLUG,
  seedMissingMemory,
  seedTeamMemory,
  TEAM_ID,
} from '@/stories/fixtures/team-memory';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/:section" element={<TeamSection />} />
);

const at = teamSectionPath(SLUG, TEAM_ID, 'memory');

const meta = {
  title: 'Team/Memory',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={loadTeamMemory}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyTeamMemory}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTeamMemory}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeamMemory}>
      {routes}
    </StoryPage>
  ),
};

export const Opened: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeamMemory}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: /410 Gone/ }),
    );
  },
};

export const Retired: Story = {
  render: () => (
    <StoryPage at={`${at}?standing=retired`} seed={seedTeamMemory}>
      {routes}
    </StoryPage>
  ),
};

export const Writing: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeamMemory}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Write a memory' }),
    );
  },
};

export const Focused: Story = {
  render: () => (
    <StoryPage at={`${at}?memory=${FOCUSED_ID}`} seed={seedTeamMemory}>
      {routes}
    </StoryPage>
  ),
};

export const FocusedMissing: Story = {
  render: () => (
    <StoryPage at={`${at}?memory=${MISSING_ID}`} seed={seedMissingMemory}>
      {routes}
    </StoryPage>
  ),
};
