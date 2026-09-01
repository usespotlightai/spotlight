import { Inbox } from 'lucide-react';
import { Link } from 'react-router';
import { InProgress } from '@/components/common/InProgress';
import { Pill } from '@/components/common/Pill';
import type { Task } from '@/lib/task';

type TaskStateProps = {
  task: Task;
  reviewTo?: string;
};

export function TaskState({ task, reviewTo }: TaskStateProps) {
  if (task.awaitingReview) {
    const asked = (
      <Pill lead={<Inbox className="size-3.5 shrink-0" aria-hidden />}>
        Awaiting review
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

  if (task.running) {
    return <InProgress />;
  }

  return null;
}
