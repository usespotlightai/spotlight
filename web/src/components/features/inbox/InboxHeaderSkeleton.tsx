import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';

export function InboxHeaderSkeleton() {
  return (
    <PageHeader
      title={
        <>
          <Skeleton className="size-6 rounded" />
          <SkeletonLine className="w-20" />
          <ChevronRight
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <SkeletonLine className="w-48" />
        </>
      }
    />
  );
}
