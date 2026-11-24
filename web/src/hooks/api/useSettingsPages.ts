import { useQuery } from '@tanstack/react-query';

import { listSettingsPages } from '@/lib/api';

const settingsPageKeys = {
  all: ['settings-pages'] as const,
};

// The pages that the deployment adds to the settings. They change only when the deployment changes, so the app reads them once.
export function useSettingsPages() {
  return useQuery({
    queryKey: settingsPageKeys.all,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await listSettingsPages({ throwOnError: true });
      return data.pages;
    },
  });
}
