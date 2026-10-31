import { SquareMousePointer } from 'lucide-react';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { Pill } from '@/components/shared/Pill';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonBlock } from '@/components/shared/skeleton/SkeletonBlock';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

const PROMPT = ['w-12', 'w-full', 'w-5/6', 'w-full', 'w-2/3', 'w-3/4', 'w-1/2'];

export function StationConfigSkeleton() {
  return (
    <div className="grid grid-flow-row-dense auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SkeletonBlock>
        <ConfigCard title="Agent">
          <ConfigCardValue
            lead={<Skeleton className="size-4 rounded" />}
            detail={<SkeletonLine className="w-16" />}
          >
            <SkeletonLine className="w-24" />
          </ConfigCardValue>
        </ConfigCard>
      </SkeletonBlock>

      <SkeletonBlock>
        <ConfigCard title="Prompt">
          <div className="flex min-h-[182px] flex-col">
            {PROMPT.map((width, at) => (
              <SkeletonLine
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder lines have no identity
                key={at}
                className={cn(width, 'text-sm leading-6')}
              />
            ))}
          </div>
        </ConfigCard>
      </SkeletonBlock>

      <SkeletonBlock>
        <ConfigCard title="Skills">
          <ConfigCardValue
            lead={
              <SquareMousePointer
                aria-hidden
                className="size-4 text-muted-foreground"
              />
            }
            detail="given to its runs"
          >
            <SkeletonLine className="w-5" />
          </ConfigCardValue>
          <span className="flex">
            <Pill>
              <SkeletonLine className="w-24" />
            </Pill>
          </span>
        </ConfigCard>
      </SkeletonBlock>

      <SkeletonBlock className="sm:col-span-2">
        <ConfigCard title="Judge">
          <div className="flex items-center gap-3">
            <Skeleton className="size-28 rounded-full" />
            <ConfigCardValue detail={<SkeletonLine className="w-16" />}>
              <SkeletonLine className="w-12" />
            </ConfigCardValue>
          </div>
        </ConfigCard>
      </SkeletonBlock>

      <SkeletonBlock>
        <ConfigCard title="Line">
          <ConfigCardValue detail={<SkeletonLine className="w-24" />}>
            <SkeletonLine className="w-20" />
          </ConfigCardValue>
          <span className="flex">
            <Pill>
              <SkeletonLine className="w-20" />
            </Pill>
          </span>
        </ConfigCard>
      </SkeletonBlock>

      <SkeletonBlock>
        <ConfigCard title="Automatic improvement">
          <ConfigCardValue detail={<SkeletonLine className="w-36" />}>
            <SkeletonLine className="w-8" />
          </ConfigCardValue>
        </ConfigCard>
      </SkeletonBlock>

      <SkeletonBlock>
        <ConfigCard title="Config fingerprint">
          <ConfigCardValue detail={<SkeletonLine className="w-28" />}>
            <SkeletonLine className="w-28" />
          </ConfigCardValue>
        </ConfigCard>
      </SkeletonBlock>
    </div>
  );
}
