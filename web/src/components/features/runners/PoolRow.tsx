import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { PoolWayOut } from '@/components/features/runners/PoolWayOut';
import { RunnerChildren } from '@/components/features/runners/RunnerChildren';
import { StatusDot } from '@/components/features/runners/StatusDot';
import {
  type NamedHarness,
  type PushPool,
  poolHarnesses,
  poolName,
  poolStatus,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

type PoolRowProps = {
  slug: string;
  pool: PushPool;
  harnesses: readonly NamedHarness[] | undefined;
};

export function PoolRow({ slug, pool, harnesses }: PoolRowProps) {
  const name = poolName(pool.through);

  return (
    <li data-slot="pool-row">
      <div className={cn(HOST_ROW, HOST_ROW_HOVER, HOST_COLUMNS)}>
        <span className="min-w-0 truncate text-foreground">{name}</span>

        <PoolWayOut slug={slug} poolKey={pool.through.key} />

        <StatusDot
          tone={
            pool.runners.some((runner) => runner.currentRun) ? 'busy' : 'ready'
          }
        >
          {poolStatus(pool)}
        </StatusDot>

        <span />

        <HarnessLogos harnesses={poolHarnesses(pool, harnesses)} />

        <span />
        <span />
      </div>

      <RunnerChildren
        slug={slug}
        of={name}
        runners={pool.runners}
        harnesses={harnesses}
      />
    </li>
  );
}
