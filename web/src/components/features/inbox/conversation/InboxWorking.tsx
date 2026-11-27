import {
  Bot,
  CircleDashed,
  Eye,
  type LucideIcon,
  Terminal,
} from 'lucide-react';
import { useParams } from 'react-router';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { QueuedForOfflineHosts } from '@/components/features/runners/QueuedForOfflineHosts';
import { ARRIVING, type RunJournal, workingWordsOf } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';
import type { ShownProgress } from '@/lib/run';
import { quietHostsOf, type RunWaiting } from '@/lib/run-waiting';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type BackgroundTask = RunJournal['background'][number];

const BACKGROUND_ICONS: Record<BackgroundTask['kind'], LucideIcon> = {
  command: Terminal,
  monitor: Eye,
  subagent: Bot,
  other: CircleDashed,
};

type InboxWorkingProps = {
  station: string;
  stationColor: string;
  stationPosition: number;
  stationCount: number;
  progress: ShownProgress;
  // Why the queued run waits, so that it can say when its hosts are all offline.
  waiting?: RunWaiting | null;
  session?: Pick<RunJournal, 'activity' | 'background'>;
};

export function InboxWorking({
  station,
  stationColor,
  stationPosition,
  stationCount,
  progress,
  waiting,
  session,
}: InboxWorkingProps) {
  const { slug } = useParams();
  const quiet = progress === 'queued' ? quietHostsOf(waiting) : null;
  const background =
    progress === 'in-progress' ? (session?.background ?? []) : [];

  return (
    <li className={cn('px-1 pt-3 pb-0.5 text-xs leading-6', ARRIVING)}>
      <div className="flex items-center gap-1.5">
        <StationIcon
          share={stationShare(stationPosition, stationCount)}
          color={stationColor}
        />
        {quiet && nonEmpty(slug) ? (
          <QueuedForOfflineHosts slug={slug} quiet={quiet} what="run" />
        ) : (
          <span
            className={cn(
              progress !== 'in-progress' && 'text-muted-foreground',
              progress !== 'queued' && 'animate-pulse',
            )}
          >
            {workingWordsOf(progress, station, session)}
          </span>
        )}
      </div>

      {background.length > 0 && (
        <ul aria-label="Background work" className="pl-5 text-muted-foreground">
          {background.map((task) => {
            const Icon = BACKGROUND_ICONS[task.kind];

            return (
              <li key={task.id} className="flex min-w-0 items-center gap-1.5">
                <Icon aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{task.description}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
