import { useQuery } from '@tanstack/react-query';
import { listWorkspaceInvites } from '@/lib/api';

export const inviteKeys = {
  forWorkspace: (slug?: string) => ['invites', slug ?? null] as const,
  byToken: (token?: string) => ['invite', token ?? null] as const,
};

export function useWorkspaceInvites(slug: string | undefined) {
  return useQuery({
    queryKey: inviteKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceInvites({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
