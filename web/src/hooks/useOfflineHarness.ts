import { useRunners } from '@/hooks/api/useRunners';
import { type OfflineHarness, offlineHarnessOf } from '@/lib/runner';

// Why work for the harness waits, when its hosts are all offline. Pass no slug while nothing is queued, so that nothing polls.
export function useOfflineHarness(
  slug: string | undefined,
  harness: string | undefined,
): OfflineHarness | null {
  const { data: fleet } = useRunners(slug);

  return offlineHarnessOf(fleet, harness);
}
