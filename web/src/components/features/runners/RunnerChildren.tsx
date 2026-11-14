import { IdleSandboxRow } from '@/components/features/runners/IdleSandboxRow';
import { RunnerRow } from '@/components/features/runners/RunnerRow';
import type { ActiveRunner, IdleSandbox, NamedHarness } from '@/lib/runner';

type RunnerChildrenProps = {
  slug: string;
  of: string;
  runners: readonly ActiveRunner[];
  idleSandboxes?: readonly IdleSandbox[];
  harnesses: readonly NamedHarness[] | undefined;
};

export function RunnerChildren({
  slug,
  of,
  runners,
  idleSandboxes = [],
  harnesses,
}: RunnerChildrenProps) {
  if (runners.length === 0 && idleSandboxes.length === 0) {
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
      {idleSandboxes.map((sandbox) => (
        <IdleSandboxRow key={sandbox.id} slug={slug} sandbox={sandbox} />
      ))}
    </ul>
  );
}
