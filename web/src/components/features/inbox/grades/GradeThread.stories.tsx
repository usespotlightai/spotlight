import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { GradeThread } from '@/components/features/inbox/grades/GradeThread';
import { teamCrumb } from '@/lib/team-crumb';
import { failMutations } from '@/stories/failMutations';
import {
  failGradeRun,
  GRADE_ITEM_ID,
  RUN_ID,
  refuseGradeRun,
  SLUG,
  seedGradedRun,
  seedGradeRun,
  seedGradeRunOnClaims,
  seedGradeRunOnFive,
  TASK_ID,
  TEAM_ID,
  TITLE,
} from '@/stories/fixtures/grades';
import { seedInbox } from '@/stories/fixtures/inbox';
import { StoryPage } from '@/stories/StoryPage';

const TRAIL = [
  teamCrumb(SLUG, { id: TEAM_ID, name: 'Platform' }),
  { label: TITLE },
];

const inRun =
  (...seeds: ((client: QueryClient) => void)[]) =>
  (client: QueryClient) => {
    seedInbox(client);
    for (const seed of seeds) {
      seed(client);
    }
  };

function Showing({ seed }: { seed?: (client: QueryClient) => void }) {
  return (
    <StoryPage at={`/w/${SLUG}/inbox/${GRADE_ITEM_ID}`} seed={seed}>
      <Route
        path="/w/:slug/inbox/:itemId"
        element={
          <GradeThread
            slug={SLUG}
            teamId={TEAM_ID}
            taskId={TASK_ID}
            runId={RUN_ID}
            trail={TRAIL}
          />
        }
      />
    </StoryPage>
  );
}

const meta = {
  title: 'Inbox/Grade a run',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <Showing />,
};

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={inRun(failGradeRun)} />,
};

export const MembersOnly: Story = {
  name: 'Members only',
  render: () => <Showing seed={inRun(refuseGradeRun)} />,
};

export const WithData: Story = {
  render: () => <Showing seed={inRun(seedGradeRun)} />,
};

export const Graded: Story = {
  render: () => <Showing seed={inRun(seedGradedRun)} />,
};

export const OnFive: Story = {
  name: 'From 1 to 5',
  render: () => <Showing seed={inRun(seedGradeRunOnFive)} />,
};

export const OnClaims: Story = {
  name: 'Claim by claim',
  render: () => <Showing seed={inRun(seedGradeRunOnClaims)} />,
};

export const GradeFailed: Story = {
  name: 'Grade not saved',
  render: () => <Showing seed={inRun(seedGradeRun, failMutations)} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Yes' }));
  },
};
