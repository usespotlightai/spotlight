import { SquareMousePointer } from 'lucide-react';
import { Instrument } from '@/components/features/stations/config/Instrument';
import { InstrumentValue } from '@/components/features/stations/config/InstrumentValue';
import { Pill } from '@/components/shared/Pill';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonBlock } from '@/components/shared/skeleton/SkeletonBlock';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

const PROMPT = ['w-12', 'w-full', 'w-5/6', 'w-full', 'w-2/3', 'w-3/4', 'w-1/2'];

export function StationConfigSkeleton() {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="font-medium text-foreground text-xs">Config</h2>

      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonBlock>
          <Instrument title="Agent">
            <InstrumentValue
              lead={<Skeleton className="size-4 rounded" />}
              detail={<SkeletonLine className="w-16" />}
            >
              <SkeletonLine className="w-24" />
            </InstrumentValue>
          </Instrument>
        </SkeletonBlock>

        <SkeletonBlock>
          <Instrument title="Prompt">
            <div className="flex min-h-[182px] flex-col">
              {PROMPT.map((width, at) => (
                <SkeletonLine
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholder lines have no identity
                  key={at}
                  className={cn(width, 'text-sm leading-6')}
                />
              ))}
            </div>
          </Instrument>
        </SkeletonBlock>

        <SkeletonBlock>
          <Instrument title="Skills">
            <InstrumentValue
              lead={
                <SquareMousePointer
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
              }
              detail="given to its runs"
            >
              <SkeletonLine className="w-5" />
            </InstrumentValue>
            <span className="flex">
              <Pill>
                <SkeletonLine className="w-24" />
              </Pill>
            </span>
          </Instrument>
        </SkeletonBlock>

        <SkeletonBlock>
          <Instrument title="Judge">
            <div className="flex items-center gap-3">
              <Skeleton className="size-20 rounded-full" />
              <InstrumentValue detail={<SkeletonLine className="w-16" />}>
                <SkeletonLine className="w-12" />
              </InstrumentValue>
            </div>
          </Instrument>
        </SkeletonBlock>

        <SkeletonBlock>
          <Instrument title="Ships through">
            <InstrumentValue detail={<SkeletonLine className="w-24" />}>
              <SkeletonLine className="w-20" />
            </InstrumentValue>
            <span className="flex">
              <Pill>
                <SkeletonLine className="w-20" />
              </Pill>
            </span>
          </Instrument>
        </SkeletonBlock>

        <SkeletonBlock>
          <Instrument title="Version">
            <InstrumentValue detail={<SkeletonLine className="w-28" />}>
              <SkeletonLine className="w-28" />
            </InstrumentValue>
          </Instrument>
        </SkeletonBlock>
      </div>
    </section>
  );
}
