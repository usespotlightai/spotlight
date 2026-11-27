import { RunnerRow } from '@/components/features/runners/RunnerRow';
import type { ActiveRunner, NamedHarness } from '@/lib/runner';

type RunnerChildrenProps = {
  slug: string;
  of: string;
  runners: readonly ActiveRunner[];
  harnesses: readonly NamedHarness[] | undefined;
};

export function RunnerChildren({
  slug,
  of,
  runners,
  harnesses,
}: RunnerChildrenProps) {
  if (runners.length === 0) {
    return null;
  }

  return (
    <ul aria-label={`Runners on ${of}`} className="flex flex-col">
      {runners.map((runner) => (
        <RunnerRow
          key={runner.id}
          slug={slug}
          runner={runner}
          harnesses={harnesses}
        />
      ))}
    </ul>
  );
}
