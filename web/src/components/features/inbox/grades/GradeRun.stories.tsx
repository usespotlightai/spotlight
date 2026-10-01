import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { GradeRun } from '@/components/features/inbox/grades/GradeRun';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { failMutations } from '@/stories/failMutations';
import {
  DESCRIPTION,
  failGradeRun,
  GRADE_ITEM_ID,
  RUN_ID,
  refuseGradeRun,
  SLUG,
  seedGradedRun,
  seedGradeRun,
  seedGradeRunOnFive,
  seedGradeRunWithoutChanges,
  TASK_ID,
  TEAM_ID,
  TITLE,
} from '@/stories/fixtures/grades';
import { StoryShell } from '@/stories/StoryShell';

function Showing({ seed }: { seed?: (client: QueryClient) => void }) {
  return (
    <StoryShell at={`/w/${SLUG}/inbox/${GRADE_ITEM_ID}`} seed={seed}>
      <Route
        path="/w/:slug/inbox/:itemId"
        element={
          <ChangesPanel>
            <div className="mx-auto max-w-3xl p-6">
              <GradeRun
                slug={SLUG}
                teamId={TEAM_ID}
                taskId={TASK_ID}
                runId={RUN_ID}
                title={TITLE}
                description={DESCRIPTION}
              />
            </div>
          </ChangesPanel>
        }
      />
    </StoryShell>
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

export const Empty: Story = {
  name: 'No changes',
  render: () => <Showing seed={seedGradeRunWithoutChanges} />,
};

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={failGradeRun} />,
};

export const MembersOnly: Story = {
  name: 'Members only',
  render: () => <Showing seed={refuseGradeRun} />,
};

export const WithData: Story = {
  render: () => <Showing seed={seedGradeRun} />,
};

export const Graded: Story = {
  render: () => <Showing seed={seedGradedRun} />,
};

export const OnFive: Story = {
  name: 'From 1 to 5',
  render: () => <Showing seed={seedGradeRunOnFive} />,
};

export const GradeFailed: Story = {
  name: 'Grade not saved',
  render: () => (
    <Showing
      seed={(client) => {
        seedGradeRun(client);
        failMutations(client);
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Yes' }));
  },
};
