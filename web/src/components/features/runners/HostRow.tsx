import { HOST_COLUMNS } from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { HostImageCell } from '@/components/features/runners/HostImageCell';
import { HostStanding } from '@/components/features/runners/HostStanding';
import {
  type Host,
  type NamedHarness,
  namedHarnesses,
  seenAt,
  through,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

type HostRowProps = {
  host: Host;
  harnesses: readonly NamedHarness[] | undefined;
};

const servedBy = (
  host: Host,
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  namedHarnesses(
    host.images
      .filter((image) => !image.refused)
      .flatMap((image) => image.harnesses)
      .filter(
        (each, at, all) =>
          all.findIndex((other) => other.id === each.id) === at,
      ),
    harnesses,
  );

export function HostRow({ host, harnesses }: HostRowProps) {
  return (
    <li
      className={cn(
        'grid h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors hover:bg-accent',
        HOST_COLUMNS,
      )}
    >
      <span className="min-w-0 truncate text-foreground">{host.name}</span>

      <span className="min-w-0 truncate text-muted-foreground text-xs">
        {through(host.through)}
      </span>

      <HostStanding host={host} />

      <HostImageCell images={host.images} />

      <HarnessLogos harnesses={servedBy(host, harnesses)} />

      <span className="truncate text-muted-foreground text-xs tabular-nums">
        {host.release}
      </span>

      <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
        {seenAt(host)}
      </span>
    </li>
  );
}
