import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { cn } from '@/lib/utils';

export function PillSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-6 rounded-full', className)} />;
}
