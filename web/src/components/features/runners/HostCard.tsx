import { HostImages } from '@/components/features/runners/HostImages';
import { HostStanding } from '@/components/features/runners/HostStanding';
import { type Host, type NamedHarness, seenAt, through } from '@/lib/runner';

type HostCardProps = {
  host: Host;
  harnesses: readonly NamedHarness[] | undefined;
};

export function HostCard({ host, harnesses }: HostCardProps) {
  return (
    <li className="flex min-h-36 flex-col justify-between gap-5 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate font-medium text-foreground text-sm">
            {host.name}
          </h3>

          <span className="ml-auto">
            <HostStanding host={host} />
          </span>
        </div>

        <p className="truncate text-muted-foreground text-xs">
          {through(host.through)}
        </p>

        <HostImages images={host.images} harnesses={harnesses} />
      </div>

      <p className="flex min-w-0 gap-1 text-muted-foreground text-xs tabular-nums">
        <span className="shrink-0">{seenAt(host)}</span>
        <span aria-hidden>·</span>
        <span className="truncate">{host.release}</span>
      </p>
    </li>
  );
}
