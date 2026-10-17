import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { HostImageCell } from '@/components/features/runners/HostImageCell';
import { HostStatus } from '@/components/features/runners/HostStatus';
import { RunnerChildren } from '@/components/features/runners/RunnerChildren';
import {
  type Host,
  heartbeatAt,
  type NamedHarness,
  servedBy,
  through,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

type HostRowProps = {
  slug: string;
  host: Host;
  harnesses: readonly NamedHarness[] | undefined;
};

export function HostRow({ slug, host, harnesses }: HostRowProps) {
  return (
    <li data-slot="host-row">
      <div className={cn(HOST_ROW, HOST_ROW_HOVER, HOST_COLUMNS)}>
        <span className="min-w-0 truncate text-foreground">{host.name}</span>

        <span className="min-w-0 truncate text-muted-foreground text-xs">
          {through(host.through)}
        </span>

        <HostStatus host={host} />

        <HostImageCell images={host.images} />

        <HarnessLogos harnesses={servedBy(host, harnesses)} />

        <span className="truncate text-muted-foreground text-xs tabular-nums">
          {host.release}
        </span>

        <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
          {heartbeatAt(host)}
        </span>
      </div>

      <RunnerChildren
        slug={slug}
        of={host.name}
        runners={host.runners}
        harnesses={harnesses}
      />
    </li>
  );
}
