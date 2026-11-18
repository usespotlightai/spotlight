import { TaskPullRequests } from '@/components/features/board/task/TaskPullRequests';
import { OpenInEditor } from '@/components/features/editor/OpenInEditor';
import { RunHold } from '@/components/features/hold/RunHold';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import type { TeamRun } from '@/lib/run';

type RunHeaderProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  trail: readonly BreadcrumbSegment[];
};

export function RunHeader({ slug, teamId, run, trail }: RunHeaderProps) {
  return (
    <PageHeader
      title={<Breadcrumbs segments={trail} />}
      actions={
        run.taskId && (
          <>
            <TaskPullRequests teamId={teamId} taskId={run.taskId} />
            <RunHold
              slug={slug}
              teamId={teamId}
              taskId={run.taskId}
              runId={run.id}
            />
            <OpenInEditor
              slug={slug}
              target={{ kind: 'task', id: run.taskId }}
            />
          </>
        )
      }
    />
  );
}
