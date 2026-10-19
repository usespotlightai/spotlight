import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { HostImageCell } from '@/components/features/runners/HostImageCell';
import { HostReleaseCell } from '@/components/features/runners/HostReleaseCell';
import { HostStatus } from '@/components/features/runners/HostStatus';
import { RowCheckbox } from '@/components/features/runners/RowCheckbox';
import { RunnerChildren } from '@/components/features/runners/RunnerChildren';
import {
  type Host,
  heartbeatAt,
  type NamedHarness,
  servedBy,
  sourceLabel,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

type HostRowProps = {
  slug: string;
  host: Host;
  harnesses: readonly NamedHarness[] | undefined;
  selectable: boolean;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
};

export function HostRow({
  slug,
  host,
  harnesses,
  selectable,
  selected,
  onSelectedChange,
}: HostRowProps) {
  return (
    <li data-slot="host-row">
      <div
        className={cn(
          'group/host',
          HOST_ROW,
          HOST_COLUMNS,
          selected ? 'bg-selected' : HOST_ROW_HOVER,
        )}
      >
        {selectable && (
          <RowCheckbox
            label={`Select ${host.name}`}
            selected={selected}
            onSelectedChange={onSelectedChange}
          />
        )}

        <span className="min-w-0 truncate text-foreground">{host.name}</span>

        <span className="min-w-0 truncate text-muted-foreground text-xs">
          {sourceLabel(host.source)}
        </span>

        <HostStatus host={host} />

        <HostImageCell images={host.images} />

        <HarnessLogos harnesses={servedBy(host, harnesses)} />

        <HostReleaseCell host={host} />

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
