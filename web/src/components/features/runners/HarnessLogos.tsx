import type { ReactElement } from 'react';

import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import type { NamedHarness } from '@/lib/runner';

const named = (harness: NamedHarness) =>
  harness.version !== null &&
  harness.version !== undefined &&
  harness.version !== ''
    ? `${harness.name} ${harness.version}`
    : harness.name;

export function HarnessLogos({
  harnesses,
}: {
  harnesses: readonly NamedHarness[];
}): ReactElement {
  if (harnesses.length === 0) {
    return <span className="text-muted-foreground text-xs">–</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {harnesses.map((harness) => (
        <span key={harness.id} title={named(harness)} className="flex">
          <HarnessLogo harness={harness.id} className="size-3.5" />
          <span className="sr-only">{named(harness)}</span>
        </span>
      ))}
    </span>
  );
}
