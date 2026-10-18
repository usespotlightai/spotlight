import { HostRow } from '@/components/features/runners/HostRow';
import { HostTable } from '@/components/features/runners/HostTable';
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
    <HostTable label="Hosts and push pools">
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
            key={poolKeyOf(pool.source)}
            slug={slug}
            pool={pool}
            harnesses={harnesses}
          />
        ))}
      </ul>
    </HostTable>
  );
}
