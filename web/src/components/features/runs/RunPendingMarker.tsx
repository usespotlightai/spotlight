import { WaitingForYouPill } from '@/components/shared/WaitingForYouPill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type Run, waitsForYou } from '@/lib/run';

type RunPendingMarkerProps = {
  run: Run;
  reviewTo?: string;
  inTrail?: boolean;
};

export function RunPendingMarker({
  run,
  reviewTo,
  inTrail,
}: RunPendingMarkerProps) {
  if (!waitsForYou(run) || (inTrail && run.review)) {
    return null;
  }

  const marker = <WaitingForYouPill />;

  return run.review && !inTrail ? (
    <TrailLink to={reviewTo ?? ''} className="relative z-10 outline-none">
      {marker}
    </TrailLink>
  ) : (
    marker
  );
}
