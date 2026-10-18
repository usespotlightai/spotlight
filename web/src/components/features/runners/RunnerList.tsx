import { useState } from 'react';
import { HostRow } from '@/components/features/runners/HostRow';
import { HostSelectionBar } from '@/components/features/runners/HostSelectionBar';
import { HostTable } from '@/components/features/runners/HostTable';
import { PoolRow } from '@/components/features/runners/PoolRow';
import { useDeleteHosts } from '@/hooks/api/useDeleteHosts';
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
  selectable: boolean;
};

export function RunnerList({
  slug,
  hosts,
  pools,
  harnesses,
  selectable,
}: RunnerListProps) {
  const [picked, setPicked] = useState<readonly string[]>([]);
  const deleting = useDeleteHosts();
  const selected = picked.filter((id) => hosts.some((host) => host.id === id));

  const select = (hostId: string, taken: boolean) =>
    setPicked((current) =>
      taken ? [...current, hostId] : current.filter((each) => each !== hostId),
    );

  const deleteSelected = () =>
    deleting.mutate(
      { slug, hostIds: selected },
      { onSuccess: () => setPicked([]) },
    );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <HostTable label="Hosts and push pools">
        <ul className="flex flex-col">
          {hosts.map((host) => (
            <HostRow
              key={host.id}
              slug={slug}
              host={host}
              harnesses={harnesses}
              selectable={selectable}
              selected={selected.includes(host.id)}
              onSelectedChange={(taken) => select(host.id, taken)}
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

      <HostSelectionBar
        count={selected.length}
        deleting={deleting.isPending}
        onDelete={deleteSelected}
        onClear={() => setPicked([])}
      />
    </div>
  );
}
