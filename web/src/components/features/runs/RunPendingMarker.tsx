import type { ReactElement } from 'react';

import { WaitingForYouPill } from '@/components/shared/WaitingForYouPill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { Run } from '@/lib/run';

type RunPendingMarkerProps = {
  run: Run;
  reviewTo?: string;
  inTrail?: boolean;
};

export function RunPendingMarker({
  run,
  reviewTo,
  inTrail,
}: RunPendingMarkerProps): ReactElement | null {
  if (!run.waitingForYou || (inTrail === true && run.review)) {
    return null;
  }

  const marker = <WaitingForYouPill />;

  return run.review && inTrail !== true ? (
    <TrailLink to={reviewTo ?? ''} className="relative z-10 outline-none">
      {marker}
    </TrailLink>
  ) : (
    marker
  );
}
