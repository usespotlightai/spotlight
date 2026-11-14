import { CornerDownRight } from 'lucide-react';

import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HiddenRunTitle } from '@/components/features/runners/HiddenRunTitle';
import { StatusDot, type Tone } from '@/components/features/runners/StatusDot';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useLineNames } from '@/hooks/api/useLineNames';
import {
  hiddenFromViewer,
  hiddenRunTip,
  type IdleSandbox,
  idleSandboxActivity,
  idleSandboxLabel,
  idleSandboxStatus,
  leasedRunPath,
  warmSandboxLabel,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

const toneOf = (sandbox: IdleSandbox): Tone =>
  sandbox.status === 'draining' ? 'gone' : 'ready';

function KeptFor({ slug, sandbox }: { slug: string; sandbox: IdleSandbox }) {
  const label = idleSandboxLabel(sandbox);
  const path = leasedRunPath(slug, sandbox.lastRun);

  if (path) {
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

function WarmFor({ slug, lineId }: { slug: string; lineId: string }) {
  const label = warmSandboxLabel(useLineNames(slug, true).get(lineId));

  return (
    <span title={label} className="truncate text-muted-foreground">
      {label}
    </span>
  );
}

type IdleSandboxRowProps = {
  slug: string;
  sandbox: IdleSandbox;
};

export function IdleSandboxRow({ slug, sandbox }: IdleSandboxRowProps) {
  const activity = idleSandboxActivity(sandbox);

  return (
    <li
      data-slot="runner-row"
      className={cn(HOST_ROW, HOST_ROW_HOVER, HOST_COLUMNS)}
    >
      <span className="col-span-2 flex min-w-0 items-center gap-1.5 pl-1">
        <CornerDownRight aria-hidden className="size-3.5 shrink-0 text-faint" />
        {sandbox.warmLineId === null ? (
          <KeptFor slug={slug} sandbox={sandbox} />
        ) : (
          <WarmFor slug={slug} lineId={sandbox.warmLineId} />
        )}
      </span>

      <StatusDot tone={toneOf(sandbox)}>{idleSandboxStatus(sandbox)}</StatusDot>

      <span />

      <span />

      <span />

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
