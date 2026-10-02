import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
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

      {known.length > 0 && <CrumbSeparator />}

      <SkeletonLine className="w-48" />
    </>
  );
}
