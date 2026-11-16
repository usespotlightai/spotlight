import { Link } from 'react-router';

import { TakenOverPill } from '@/components/features/takeover/TakenOverPill';
import { ProgressState } from '@/components/shared/ProgressState';
import { WaitingForYouPill } from '@/components/shared/WaitingForYouPill';
import type { Task } from '@/lib/task';

type TaskStateProps = {
  task: Task;
  stateTo?: string;
};

export function TaskState({ task, stateTo }: TaskStateProps) {
  if (task.takeover) {
    return <TakenOverPill takeover={task.takeover} to={stateTo} />;
  }

  if (task.awaitingReview) {
    const asked = <WaitingForYouPill />;

    return stateTo ? (
      <Link to={stateTo} className="outline-none">
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
