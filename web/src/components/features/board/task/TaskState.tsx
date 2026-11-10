import { Link } from 'react-router';
import { ProgressState } from '@/components/shared/ProgressState';
import { WaitingForYouPill } from '@/components/shared/WaitingForYouPill';
import type { Task } from '@/lib/task';

type TaskStateProps = {
  task: Task;
  reviewTo?: string;
};

export function TaskState({ task, reviewTo }: TaskStateProps) {
  if (task.awaitingReview) {
    const asked = <WaitingForYouPill />;

    return reviewTo ? (
      <Link to={reviewTo} className="outline-none">
        {asked}
      </Link>
    ) : (
      asked
    );
  }

  if (task.progress) {
    return <ProgressState progress={task.progress} />;
  }

  return null;
}
