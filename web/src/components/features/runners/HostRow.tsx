import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { HostChildren } from '@/components/features/runners/HostChildren';
import { HostImageCell } from '@/components/features/runners/HostImageCell';
import { HostReleaseCell } from '@/components/features/runners/HostReleaseCell';
import { HostStatus } from '@/components/features/runners/HostStatus';
import { RowCheckbox } from '@/components/features/runners/RowCheckbox';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  type Host,
  heartbeatAt,
  hostSlots,
  hostSlotsTip,
  type NamedHarness,
  servedBy,
  sourceLabel,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

const SLOTS = 'truncate text-muted-foreground text-xs tabular-nums';

function HostSlots({ host }: { host: Host }) {
  const slots = hostSlots(host);

  if (slots === null) {
    return <span className={SLOTS} />;
  }

  return (
    <span className="flex min-w-0">
      <WithTooltip tooltip={hostSlotsTip(host)} named={slots}>
        <span className={SLOTS}>{slots}</span>
      </WithTooltip>
    </span>
  );
}

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
        <span className="min-w-0 truncate text-foreground" title={host.name}>
          {selectable && (
            <span className="absolute inset-y-0 -left-9 w-9">
              <RowCheckbox
                label={`Select ${host.name}`}
                selected={selected}
                onSelectedChange={onSelectedChange}
              />
            </span>
          )}
          {host.name}
        </span>

        <span
          title={sourceLabel(host.source)}
          className="min-w-0 truncate text-muted-foreground text-xs"
        >
          {sourceLabel(host.source)}
        </span>

        <HostStatus host={host} />

        <HostSlots host={host} />

        <HostImageCell images={host.images} />

        <HarnessLogos harnesses={servedBy(host, harnesses)} />

        <HostReleaseCell host={host} />

        <span
          title={heartbeatAt(host)}
          className="truncate text-right text-muted-foreground text-xs tabular-nums"
        >
          {heartbeatAt(host)}
        </span>
      </div>

      <HostChildren slug={slug} host={host} harnesses={harnesses} />
    </li>
  );
}
