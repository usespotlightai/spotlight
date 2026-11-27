import type { ReactElement } from 'react';

import { RunnerRow } from '@/components/features/runners/RunnerRow';
import { SandboxRow } from '@/components/features/runners/SandboxRow';
import { type Host, hostChildren, type NamedHarness } from '@/lib/runner';

type HostChildrenProps = {
  slug: string;
  host: Host;
  harnesses: readonly NamedHarness[] | undefined;
};

export function HostChildren({
  slug,
  host,
  harnesses,
}: HostChildrenProps): ReactElement | null {
  const rows = hostChildren(host);

  if (rows.length === 0) {
    return null;
  }

  return (
    <ul aria-label={`Runners on ${host.name}`} className="flex flex-col">
      {rows.map((child) =>
        child.kind === 'run' ? (
          <RunnerRow
            key={child.runner.id}
            slug={slug}
            runner={child.runner}
            slots={1}
            harnesses={harnesses}
          />
        ) : (
          <SandboxRow
            key={child.row.id}
            slug={slug}
            host={host}
            row={child.row}
            harnesses={harnesses}
          />
        ),
      )}
    </ul>
  );
}
