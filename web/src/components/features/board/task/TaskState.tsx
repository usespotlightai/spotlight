import { Inbox } from 'lucide-react';
import { Link } from 'react-router';
import { Pill } from '@/components/shared/Pill';
import { WorkState } from '@/components/shared/WorkState';
import type { Task } from '@/lib/task';

type TaskStateProps = {
  task: Task;
  reviewTo?: string;
};

export function TaskState({ task, reviewTo }: TaskStateProps) {
  if (task.awaitingReview) {
    const asked = (
      <Pill lead={<Inbox className="size-3.5 shrink-0" aria-hidden />}>
        Waiting for you
      </Pill>
    );

    return reviewTo ? (
      <Link to={reviewTo} className="outline-none">
        {asked}
      </Link>
    ) : (
      asked
    );
  }

  if (task.work) {
    return <WorkState work={task.work} />;
  }

  return null;
}
