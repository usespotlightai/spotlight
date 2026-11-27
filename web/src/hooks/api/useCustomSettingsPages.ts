import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listCustomSettingsPages, type CustomSettingsPageDto } from '@/lib/api';

const customSettingsPageKeys = {
  all: ['custom-settings-pages'] as const,
};

// The pages that the deployment adds to the settings. They change only when the deployment changes, so the app reads them once.
export function useCustomSettingsPages(): UseQueryResult<
  CustomSettingsPageDto[]
> {
  return useQuery({
    queryKey: customSettingsPageKeys.all,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await listCustomSettingsPages({ throwOnError: true });
      return data.pages;
    },
  });
}
