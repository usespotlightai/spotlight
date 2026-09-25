import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import type { NamedHarness } from '@/lib/runner';

const PILL =
  'flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 font-medium text-muted-foreground text-xs';

type HarnessPillsProps = {
  harnesses: readonly NamedHarness[];
  named?: number;
};

export function HarnessPills({ harnesses, named = 3 }: HarnessPillsProps) {
  if (harnesses.length === 0) {
    return null;
  }

  const rest = harnesses.length - named;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {harnesses.slice(0, named).map((harness) => (
        <span key={harness.id} className={PILL}>
          <HarnessLogo harness={harness.id} className="size-3" />
          {harness.name}
          {harness.version && (
            <span className="font-normal tabular-nums">{harness.version}</span>
          )}
        </span>
      ))}

      {rest > 0 && <span className={PILL}>+{rest} more</span>}
    </span>
  );
}
