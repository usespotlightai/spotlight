import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { PoolEgress } from '@/components/features/runners/PoolEgress';
import { RunnerChildren } from '@/components/features/runners/RunnerChildren';
import { StatusDot } from '@/components/features/runners/StatusDot';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  type NamedHarness,
  PLATFORM_POOL,
  PLATFORM_POOL_WITH_EGRESS,
  platformPoolTip,
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
  const name = poolName(pool.source);

  return (
    <li data-slot="pool-row">
      <div className={cn(HOST_ROW, HOST_ROW_HOVER, HOST_COLUMNS)}>
        <span className="min-w-0 truncate text-foreground">{name}</span>

        {pool.source.platform ? (
          <span className="flex min-w-0">
            <WithTooltip
              tooltip={platformPoolTip(pool.source.platform.egress)}
              named={PLATFORM_POOL}
            >
              <span className="min-w-0 truncate text-muted-foreground text-xs">
                {pool.source.platform.egress
                  ? PLATFORM_POOL_WITH_EGRESS
                  : PLATFORM_POOL}
              </span>
            </WithTooltip>
          </span>
        ) : (
          <PoolEgress slug={slug} poolKey={pool.source.key} />
        )}

        <StatusDot
          tone={
            pool.runners.some((runner) => runner.currentRun) ? 'busy' : 'ready'
          }
        >
          {poolStatus(pool)}
        </StatusDot>

        <span />

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
