import { HostRowSkeleton } from '@/components/features/runners/HostRowSkeleton';
import { HostTable } from '@/components/features/runners/HostTable';

export function RunnerListSkeleton() {
  return (
    <HostTable>
      <ul role="status" aria-label="Loading the hosts">
        <HostRowSkeleton />
      </ul>
    </HostTable>
  );
}
