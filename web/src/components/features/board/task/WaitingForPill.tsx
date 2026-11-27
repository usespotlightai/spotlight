import { Link2 } from 'lucide-react';

import { Pill } from '@/components/shared/Pill';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { nonEmpty } from '@/lib/non-empty';
import { type Task, waitingFor } from '@/lib/task';

const NAMES = new Intl.ListFormat('en', { type: 'conjunction' });

type WaitingForPillProps = {
  task: Pick<Task, 'blockedBy'>;
};

export function WaitingForPill({ task }: WaitingForPillProps) {
  const label = waitingFor(task);

  if (!nonEmpty(label)) {
    return null;
  }

  return (
    <WithTooltip
      tooltip={`Starts when ${NAMES.format(task.blockedBy.map((each) => each.title))} ${task.blockedBy.length === 1 ? 'is' : 'are'} completed`}
    >
      <span className="flex min-w-0">
        <Pill
          lead={<Link2 className="size-3.5 shrink-0" aria-hidden />}
          className="min-w-0 max-w-56"
        >
          <span className="truncate">{label}</span>
        </Pill>
      </span>
    </WithTooltip>
  );
}
