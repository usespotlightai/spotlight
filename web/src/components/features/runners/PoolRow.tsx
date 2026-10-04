import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { RunnerChildren } from '@/components/features/runners/RunnerChildren';
import { StandingDot } from '@/components/features/runners/StandingDot';
import {
  heldBy,
  type NamedHarness,
  PUSH_POOL,
  type PushPool,
  poolName,
  poolStanding,
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

        <span className="min-w-0 truncate text-muted-foreground text-xs">
          {PUSH_POOL}
        </span>

        <StandingDot
          tone={
            pool.runners.some((runner) => runner.currentRun) ? 'busy' : 'ready'
          }
        >
          {poolStanding(pool)}
        </StandingDot>

        <span />

        <HarnessLogos harnesses={heldBy(pool, harnesses)} />

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
