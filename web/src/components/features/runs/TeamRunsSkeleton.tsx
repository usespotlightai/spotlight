import { ChevronDown } from 'lucide-react';
import { RunRowSkeleton } from '@/components/features/runs/RunRowSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Disclosure } from '@/components/shell/layout/Disclosure';

export function TeamRunsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the runs"
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1.5"
    >
      <section className="flex flex-col pt-1.5">
        <span className="mx-1.5 flex h-9 items-center gap-2 rounded-md bg-accent px-3 font-medium text-foreground text-xs">
          <ChevronDown className="size-3 shrink-0" aria-hidden />
          <SkeletonLine className="w-8" />
          <SkeletonLine className="w-2" />
        </span>

        <Disclosure open className="px-1.5">
          <RunRowSkeleton gutter />
        </Disclosure>
      </section>
    </div>
  );
}
