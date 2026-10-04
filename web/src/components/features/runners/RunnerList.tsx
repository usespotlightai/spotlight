import { HostHead } from '@/components/features/runners/HostHead';
import { HostRow } from '@/components/features/runners/HostRow';
import { PoolRow } from '@/components/features/runners/PoolRow';
import {
  type Host,
  type NamedHarness,
  type PushPool,
  poolKeyOf,
} from '@/lib/runner';

type RunnerListProps = {
  slug: string;
  hosts: readonly Host[];
  pools: readonly PushPool[];
  harnesses: readonly NamedHarness[] | undefined;
};

export function RunnerList({ slug, hosts, pools, harnesses }: RunnerListProps) {
  return (
    <section
      aria-label="Hosts and push pools"
      className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5"
    >
      <HostHead />

      <ul className="flex flex-col">
        {hosts.map((host) => (
          <HostRow
            key={host.id}
            slug={slug}
            host={host}
            harnesses={harnesses}
          />
        ))}
        {pools.map((pool) => (
          <PoolRow
            key={poolKeyOf(pool.through)}
            slug={slug}
            pool={pool}
            harnesses={harnesses}
          />
        ))}
      </ul>
    </section>
  );
}
