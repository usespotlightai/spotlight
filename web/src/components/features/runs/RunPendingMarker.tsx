import { Inbox } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';
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

  const marker = (
    <Pill lead={<Inbox className="size-3.5 shrink-0" aria-hidden />}>
      Waiting for you
    </Pill>
  );

  return run.review && !inTrail ? (
    <TrailLink to={reviewTo ?? ''} className="relative z-10 outline-none">
      {marker}
    </TrailLink>
  ) : (
    marker
  );
}
