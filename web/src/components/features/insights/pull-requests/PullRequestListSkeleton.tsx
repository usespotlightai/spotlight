import { Skeleton } from '@/components/shared/skeleton/Skeleton';

export function PullRequestListSkeleton() {
  return (
    <div role="status" aria-label="Loading the pull request list">
      <Skeleton className="h-40 w-full rounded-md" />
    </div>
  );
}
