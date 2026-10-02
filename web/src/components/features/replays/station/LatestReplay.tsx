import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { SuccessAgainstBaseline } from '@/components/features/replays/SuccessAgainstBaseline';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useReplays } from '@/hooks/api/useReplays';
import { loading } from '@/lib/query';
import {
  baselineIn,
  candidateShown,
  latestOf,
  successAgainst,
} from '@/lib/replay';
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
  const box = cn(
    'flex min-w-0 flex-wrap items-center gap-2 text-xs',
    className,
  );

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

  return (
    <span className={box}>
      <span className="truncate text-muted-foreground">
        Latest: {candidateShown(latest.candidate)}
      </span>
      <ReplayStatePill state={latest.state} />
      <SuccessAgainstBaseline
        success={successAgainst(latest, baselineIn(all))}
        isBaseline={latest.isBaseline}
      />
    </span>
  );
}
