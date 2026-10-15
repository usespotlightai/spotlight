import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { SuccessAgainstBaseline } from '@/components/features/replays/SuccessAgainstBaseline';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useReplays } from '@/hooks/api/useReplays';
import { percentShown } from '@/lib/judge';
import { COMPACT_PILL } from '@/lib/pill';
import { loading } from '@/lib/query';
import { baselineIn, candidateShown, latestOf } from '@/lib/replay';
import { NO_SCORE_YET, SUCCEEDED } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type LatestReplayProps = {
  teamId: string;
  setId: string;
  className?: string;
};

export function LatestReplay({ teamId, setId, className }: LatestReplayProps) {
  const replays = useReplays(teamId, setId);
  const all = replays.data ?? [];
  const latest = latestOf(all);
  const box = cn('flex min-w-0 items-center gap-2 text-xs', className);

  if (loading(replays)) {
    return (
      <span className={box}>
        <SkeletonLine className="w-32" />
      </span>
    );
  }

  if (!latest) {
    return (
      <span className={cn(box, 'text-muted-foreground')}>Not replayed yet</span>
    );
  }

  const { successRate } = latest.totals;

  return (
    <span className={box}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="relative z-10 truncate rounded-sm text-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            />
          }
        >
          {successRate === null
            ? NO_SCORE_YET
            : `${percentShown(successRate)} ${SUCCEEDED}`}
        </TooltipTrigger>
        <TooltipContent className="flex max-w-xs flex-col gap-1 text-xs">
          <span className="text-foreground">
            {candidateShown(latest.candidate)}
          </span>
          <SuccessAgainstBaseline
            replay={latest}
            baselineId={baselineIn(all)?.id ?? null}
          />
        </TooltipContent>
      </Tooltip>
      <ReplayStatePill state={latest.state} className={COMPACT_PILL} />
    </span>
  );
}
