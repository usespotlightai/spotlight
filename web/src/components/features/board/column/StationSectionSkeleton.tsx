import { ChevronDown, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Disclosure } from '@/components/shell/layout/Disclosure';

export function StationSectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <section className="relative flex flex-col">
      <header className="sticky top-0 z-10 mx-1.5 flex h-9 shrink-0 select-none items-center gap-2 rounded-md bg-accent px-3">
        <span
          aria-hidden
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
        >
          <ChevronDown className="size-3" />
        </span>

        <StationIconSkeleton />

        <span className="flex min-w-0 py-0.5 pr-1.5 font-medium text-sm">
          <SkeletonLine className="w-24" />
        </span>

        <SkeletonLine className="w-2 shrink-0 text-xs" />

        <span
          aria-hidden
          className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          <Plus className="size-3.5" />
        </span>
      </header>

      <Disclosure open className="gap-0">
        {children}
      </Disclosure>
    </section>
  );
}
