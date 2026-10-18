import { FlaggedCell } from '@/components/features/runners/FlaggedCell';
import type { Host } from '@/lib/runner';

export function HostReleaseCell({ host }: { host: Host }) {
  if (!host.unavailableReason) {
    return (
      <span className="truncate text-muted-foreground text-xs tabular-nums">
        {host.release}
      </span>
    );
  }

  return (
    <FlaggedCell reason={host.unavailableReason}>{host.release}</FlaggedCell>
  );
}
