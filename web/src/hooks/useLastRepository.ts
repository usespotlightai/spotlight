import { useRemembered } from '@/hooks/useRemembered';

const STORAGE_KEY = 'spotlight.last-repository';

export function useLastRepository(): [string, (repository: string) => void] {
  return useRemembered(STORAGE_KEY, '');
}
