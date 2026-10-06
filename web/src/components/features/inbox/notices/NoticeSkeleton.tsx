import { InboxHeaderSkeleton } from '@/components/features/inbox/InboxHeaderSkeleton';
import { PillSkeleton } from '@/components/shared/skeleton/PillSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function NoticeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the notice"
      data-slot="notice-skeleton"
      className="flex min-h-0 flex-1 flex-col"
    >
      <InboxHeaderSkeleton />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-8 py-8">
        <div className="flex flex-col gap-3">
          <SkeletonLine className="mx-auto w-24 text-xs" />
          <SkeletonLine className="w-80 text-base" />
        </div>
        <div className="flex flex-col gap-1.5">
          <SkeletonLine className="w-28 text-xs" />
          <SkeletonLine className="w-full text-sm" />
          <SkeletonLine className="w-5/6 text-sm" />
          <SkeletonLine className="w-2/3 text-sm" />
        </div>
        <PillSkeleton className="w-28" />
      </div>
    </div>
  );
}
