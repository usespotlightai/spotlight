import { HarnessLogo } from '@/components/features/stations/HarnessLogo';

export type NamedHarness = {
  readonly id: string;
  readonly name: string;
};

const PILL =
  'flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 font-medium text-muted-foreground text-xs';

const NAMED = 3;

export function HarnessPills({
  harnesses,
}: {
  harnesses: readonly NamedHarness[];
}) {
  if (harnesses.length === 0) {
    return null;
  }

  const rest = harnesses.length - NAMED;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {harnesses.slice(0, NAMED).map((harness) => (
        <span key={harness.id} className={PILL}>
          <HarnessLogo harness={harness.id} className="size-3" />
          {harness.name}
        </span>
      ))}

      {rest > 0 && <span className={PILL}>+{rest} more</span>}
    </span>
  );
}
