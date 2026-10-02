import { ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

type PropertySkeletonProps = {
  lead: ReactNode;
  width: string;
};

export function PropertySkeleton({ lead, width }: PropertySkeletonProps) {
  return (
    <span className="flex h-7 w-full items-center gap-2 px-2 text-sm">
      {lead}

      <SkeletonLine className={cn(width)} />

      <ChevronsUpDown
        className="ml-auto size-3 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </span>
  );
}
