import { useNavigate } from 'react-router';
import { TaskActions } from '@/components/features/board/task/TaskActions';
import { TaskProperties } from '@/components/features/board/task/TaskProperties';
import { TaskActivity } from '@/components/features/runs/TaskActivity';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDeleteTask } from '@/hooks/api/useDeleteTask';
import type { LineResponseDto } from '@/lib/api';
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
        trailing={<TaskActions title={task.title} onDelete={remove} />}
      />

      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-8 py-8">
          <main className="flex min-w-0 flex-1 flex-col gap-3">
            <h1 className="font-semibold text-2xl text-foreground leading-8 tracking-tight">
              {task.title}
            </h1>

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

            <div className="pt-4">
              <TaskActivity slug={slug} teamId={teamId} taskId={task.id} />
            </div>
          </main>

          <TaskProperties slug={slug} teamId={teamId} task={task} line={line} />
        </div>
      </ScrollArea>
    </>
  );
}
