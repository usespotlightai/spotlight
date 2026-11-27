import { Skeleton } from '@/components/shared/skeleton/Skeleton';

export function OpenInEditorSkeleton() {
  return (
    <Skeleton className="h-7 w-12 rounded-lg pointer-coarse:h-10 @xl/pane:w-40" />
  );
}
