import { ChevronRight } from 'lucide-react';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';

export function TrailSkeleton({
  known,
}: {
  known: readonly BreadcrumbSegment[];
}) {
  return (
    <>
      <Breadcrumbs segments={known} />

      {known.length > 0 && (
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}

      <SkeletonLine className="w-48" />
    </>
  );
}
