import type { ReactNode } from 'react';
import { ConfigChanges } from '@/components/features/stations/ConfigChanges';
import type { ConfigChange } from '@/lib/station-config';

type ChangedFromLiveProps = {
  changes: readonly ConfigChange[];
  same: string;
  from?: ReactNode;
};

export function ChangedFromLive({ changes, same, from }: ChangedFromLiveProps) {
  if (changes.length === 0) {
    return <p className="text-muted-foreground text-xs">{same}</p>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
      <span className="text-muted-foreground">
        Changed from live{from ? <> {from}</> : null}:
      </span>
      <ConfigChanges changes={changes} />
    </div>
  );
}
