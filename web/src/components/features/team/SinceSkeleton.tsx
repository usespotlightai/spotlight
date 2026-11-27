import type { ReactElement } from 'react';

import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function SinceSkeleton(): ReactElement {
  return (
    <span className="ml-auto flex w-20 shrink-0 justify-end text-xs">
      <SkeletonLine className="w-8" />
    </span>
  );
}
