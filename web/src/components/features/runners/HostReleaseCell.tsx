import type { ReactElement } from 'react';

import { FlaggedCell } from '@/components/features/runners/FlaggedCell';
import { nonEmpty } from '@/lib/non-empty';
import type { Host } from '@/lib/runner';

export function HostReleaseCell({ host }: { host: Host }): ReactElement {
  if (!nonEmpty(host.unavailableReason)) {
    return (
      <span
        title={host.release}
        className="truncate text-muted-foreground text-xs tabular-nums"
      >
        {host.release}
      </span>
    );
  }

  return (
    <FlaggedCell reason={host.unavailableReason}>{host.release}</FlaggedCell>
  );
}
