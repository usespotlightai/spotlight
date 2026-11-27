import { CornerDownRight } from 'lucide-react';
import type { ReactElement } from 'react';

import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { HiddenRunTitle } from '@/components/features/runners/HiddenRunTitle';
import { ImagePill } from '@/components/features/runners/ImagePill';
import { StatusDot } from '@/components/features/runners/StatusDot';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useLineNames } from '@/hooks/api/useLineNames';
import { nonEmpty } from '@/lib/non-empty';
import {
  type Host,
  hiddenFromViewer,
  hiddenRunTip,
  type IdleSandbox,
  idleSandboxLabel,
  imageHarnesses,
  isWarm,
  leasedRunPath,
  type NamedHarness,
  type SandboxRow as Row,
  sandboxActivity,
  sandboxStatus,
  sandboxStatusTip,
  warmSandboxLabel,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

function LastRunTitle({
  slug,
  sandbox,
}: {
  slug: string;
  sandbox: IdleSandbox;
}) {
  const label = idleSandboxLabel(sandbox);
  const path = leasedRunPath(slug, sandbox.lastRun);

  if (nonEmpty(path)) {
    return (
      <TrailLink
        to={path}
        title={label}
        className="truncate rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
      </TrailLink>
    );
  }

  if (sandbox.lastRun && hiddenFromViewer(sandbox.lastRun)) {
    return <HiddenRunTitle tip={hiddenRunTip(sandbox.lastRun)} />;
  }

  return (
    <span title={label} className="truncate text-muted-foreground">
      {label}
    </span>
  );
}

type SandboxRowProps = {
  slug: string;
  host: Host;
  row: Row;
  harnesses: readonly NamedHarness[] | undefined;
};

export function SandboxRow({
  slug,
  host,
  row,
  harnesses,
}: SandboxRowProps): ReactElement {
  const [first] = row.sandboxes;
  const lineNames = useLineNames(slug, isWarm(first));
  const lineName =
    first.warmLineId === null ? undefined : lineNames.get(first.warmLineId);
  const label = warmSandboxLabel(row.sandboxes.length, lineName);
  const activity = sandboxActivity(row);

  return (
    <li
      data-slot="runner-row"
      className={cn(HOST_ROW, HOST_ROW_HOVER, HOST_COLUMNS)}
    >
      <span className="col-span-2 flex min-w-0 items-center gap-1.5 pl-1">
        <CornerDownRight aria-hidden className="size-3.5 shrink-0 text-faint" />
        {isWarm(first) ? (
          <span title={label} className="truncate text-muted-foreground">
            {label}
          </span>
        ) : (
          <LastRunTitle slug={slug} sandbox={first} />
        )}
      </span>

      <StatusDot
        tone={first.status === 'draining' ? 'gone' : 'ready'}
        tip={sandboxStatusTip(first, lineName)}
      >
        {sandboxStatus(first)}
      </StatusDot>

      <span className="truncate text-muted-foreground text-xs tabular-nums">
        {row.sandboxes.length}
      </span>

      <span className="flex min-w-0">
        {nonEmpty(first.image) && (
          <ImagePill image={first.image} title={first.image} />
        )}
      </span>

      <HarnessLogos harnesses={imageHarnesses(host, first.image, harnesses)} />

      <span />

      <span
        title={activity}
        className="truncate text-right text-muted-foreground text-xs tabular-nums"
      >
        {activity}
      </span>
    </li>
  );
}
