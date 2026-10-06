import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { runPath } from '@/lib/run';
import { Run } from '@/routes/Run';
import {
  failReplayRun,
  REPLAY_RUN_ID,
  seedEmptyReplayRun,
  seedReplayRun,
  seedReplayRunAwaiting,
} from '@/stories/fixtures/replays';
import {
  emptyRun,
  failRun,
  RUN_ID,
  rememberedFailedRun,
  rememberingRun,
  SLUG,
  seedApprovalWaitingRun,
  seedCarryingOnRun,
  seedRun,
  seedWaitingRun,
  TEAM_ID,
} from '@/stories/fixtures/run';
import {
  failSearchRun,
  SEARCH_RUN_ID,
  seedEmptySearchRun,
  seedSearchRun,
  seedSearchRunAwaiting,
} from '@/stories/fixtures/searches';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/runs/:runId" element={<Run />} />
);

const at = runPath(SLUG, TEAM_ID, RUN_ID);

const replayAt = runPath(SLUG, TEAM_ID, REPLAY_RUN_ID);

const searchAt = runPath(SLUG, TEAM_ID, SEARCH_RUN_ID);

const meta = {
  title: 'Team/Runs/Run',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyRun}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failRun}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedRun}>
      {routes}
    </StoryPage>
  ),
};

export const Remembered: Story = {
  render: () => (
    <StoryPage at={at} seed={seedRun}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Remembered' }),
    );
  },
};

export const RememberedFailed: Story = {
  render: () => (
    <StoryPage at={at} seed={rememberedFailedRun}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Remembered' }),
    );
  },
};

export const RememberedLoading: Story = {
  render: () => (
    <StoryPage at={at} seed={rememberingRun}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Remembered' }),
    );
  },
};

export const WaitingForYou: Story = {
  name: 'Waiting for you',
  render: () => (
    <StoryPage at={at} seed={seedWaitingRun}>
      {routes}
    </StoryPage>
  ),
};

export const ApprovalWaiting: Story = {
  name: 'Approval waiting for you',
  render: () => (
    <StoryPage at={at} seed={seedApprovalWaitingRun}>
      {routes}
    </StoryPage>
  ),
};

export const CarryingOn: Story = {
  name: 'Carrying on after the answer',
  render: () => (
    <StoryPage at={at} seed={seedCarryingOnRun}>
      {routes}
    </StoryPage>
  ),
};

export const ReplayLoading: Story = {
  name: 'Replay run loading',
  render: () => (
    <StoryPage at={replayAt} seed={seedReplayRunAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const ReplayEmpty: Story = {
  name: 'Replay run empty',
  render: () => (
    <StoryPage at={replayAt} seed={seedEmptyReplayRun}>
      {routes}
    </StoryPage>
  ),
};

export const ReplayFailed: Story = {
  name: 'Replay run error',
  render: () => (
    <StoryPage at={replayAt} seed={failReplayRun}>
      {routes}
    </StoryPage>
  ),
};

export const Replay: Story = {
  name: 'Replay run',
  render: () => (
    <StoryPage at={replayAt} seed={seedReplayRun}>
      {routes}
    </StoryPage>
  ),
};

export const SearchLoading: Story = {
  name: 'Search run loading',
  render: () => (
    <StoryPage at={searchAt} seed={seedSearchRunAwaiting}>
      {routes}
    </StoryPage>
  ),
};

export const SearchEmpty: Story = {
  name: 'Search run empty',
  render: () => (
    <StoryPage at={searchAt} seed={seedEmptySearchRun}>
      {routes}
    </StoryPage>
  ),
};

export const SearchFailed: Story = {
  name: 'Search run error',
  render: () => (
    <StoryPage at={searchAt} seed={failSearchRun}>
      {routes}
    </StoryPage>
  ),
};

export const Search: Story = {
  name: 'Search run',
  render: () => (
    <StoryPage at={searchAt} seed={seedSearchRun}>
      {routes}
    </StoryPage>
  ),
};
