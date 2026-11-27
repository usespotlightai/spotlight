import {
  CircleAlert,
  CircleDashed,
  CircleStop,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';

import { WithTooltip } from '@/components/shared/WithTooltip';
import { nonEmpty } from '@/lib/non-empty';
import { formatState, type ReplayState, stateNote } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type ShownState = Exclude<ReplayState, 'finished'>;

const ICONS: Record<ShownState, { icon: LucideIcon; className: string }> = {
  queued: { icon: CircleDashed, className: 'text-muted-foreground' },
  running: {
    icon: LoaderCircle,
    className: 'animate-spin text-chart-primary motion-reduce:animate-none',
  },
  stopped: { icon: CircleStop, className: 'text-muted-foreground' },
  'ceiling-reached': { icon: CircleAlert, className: 'text-destructive' },
};

export function ReplayStateIcon({
  state,
}: {
  state: ShownState;
}): ReactElement {
  const { icon: Icon, className } = ICONS[state];
  const note = stateNote(state);

  return (
    <WithTooltip
      tooltip={
        nonEmpty(note) ? `${formatState(state)}. ${note}` : formatState(state)
      }
    >
      <span className="inline-flex shrink-0">
        <Icon
          role="img"
          aria-label={formatState(state)}
          className={cn('size-3.5', className)}
        />
      </span>
    </WithTooltip>
  );
}
