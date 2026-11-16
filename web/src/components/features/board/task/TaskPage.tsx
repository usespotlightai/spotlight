import { useNavigate } from 'react-router';

import { TaskActions } from '@/components/features/board/task/TaskActions';
import { TASK_LAYOUT } from '@/components/features/board/task/TaskLayout';
import { TaskProperties } from '@/components/features/board/task/TaskProperties';
import { OnHoldPill } from '@/components/features/hold/OnHoldPill';
import { TaskActivity } from '@/components/features/runs/TaskActivity';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { PageTitle } from '@/components/shared/PageTitle';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDeleteTask } from '@/hooks/api/useDeleteTask';
import type { LineResponseDto } from '@/lib/api';
import { runPath } from '@/lib/run';
import type { Task } from '@/lib/task';
import { linePath, teamPath } from '@/lib/team';

type TaskPageProps = {
  slug?: string;
  teamId?: string;
  task: Task;
  line?: LineResponseDto;
  trail: readonly BreadcrumbSegment[];
};

export function TaskPage({ slug, teamId, task, line, trail }: TaskPageProps) {
  const deleteTask = useDeleteTask();
  const navigate = useNavigate();
  const hold = task.hold;

  const remove = () => {
    if (!teamId) {
      return;
    }

    deleteTask.mutate(
      { teamId, taskId: task.id },
      {
        onSuccess: () =>
          void navigate(
            slug && line
              ? linePath(slug, teamId, line.id)
              : teamPath(slug ?? '', teamId),
          ),
      },
    );
  };

  return (
    <>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        heading={false}
        trailing={<TaskActions title={task.title} onDelete={remove} />}
        actions={
          hold && (
            <OnHoldPill
              hold={hold}
              to={
                slug && teamId && hold.runId
                  ? runPath(slug, teamId, hold.runId)
                  : undefined
              }
            />
          )
        }
      />

      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
        <div className={TASK_LAYOUT}>
          <main className="flex min-w-0 flex-col gap-3">
            <PageTitle>{task.title}</PageTitle>

            {task.description ? (
              <MarkdownEditor
                readOnly
                initialValue={task.description}
                placeholder=""
                ariaLabel="Description"
                className="border-none bg-transparent p-0"
              />
            ) : (
              <p className="text-muted-foreground text-sm">No description</p>
            )}

            <AttachmentTiles attachments={task.attachments} />
          </main>

          <TaskProperties slug={slug} teamId={teamId} task={task} line={line} />

          <div className="min-w-0 pt-4">
            <TaskActivity
              slug={slug}
              teamId={teamId}
              taskId={task.id}
              hold={task.hold}
            />
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
