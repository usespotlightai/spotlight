import { useQuery } from '@tanstack/react-query';
import { listWorkspaceMembers } from '@/lib/api';

export const workspaceMemberKeys = {
  forWorkspace: (slug?: string) => ['workspace-members', slug ?? null] as const,
};

export function useWorkspaceMembers(slug: string | undefined) {
  return useQuery({
    queryKey: workspaceMemberKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceMembers({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
