import { Link } from 'react-router';

import { OnHoldPill } from '@/components/features/hold/OnHoldPill';
import { ProgressState } from '@/components/shared/ProgressState';
import { WaitingForYouPill } from '@/components/shared/WaitingForYouPill';
import { nonEmpty } from '@/lib/non-empty';
import type { Task } from '@/lib/task';

type TaskStateProps = {
  task: Task;
  stateTo?: string;
};

export function TaskState({ task, stateTo }: TaskStateProps) {
  if (task.hold) {
    return <OnHoldPill hold={task.hold} to={stateTo} />;
  }

  if (task.waitingForYou) {
    const asked = <WaitingForYouPill />;

    return nonEmpty(stateTo) ? (
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
