import { HostHead } from '@/components/features/runners/HostHead';
import { HostRowSkeleton } from '@/components/features/runners/HostRowSkeleton';

export function RunnerListSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
      <HostHead />

      <ul role="status" aria-label="Loading the hosts">
        <HostRowSkeleton />
      </ul>
    </div>
  );
}
