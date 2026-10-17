import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { resolveInboxNotice } from '@/lib/api';

type ResolveInboxNoticeInput = {
  slug: string;
  noticeId: string;
};

export function useResolveInboxNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, noticeId }: ResolveInboxNoticeInput) => {
      await resolveInboxNotice({
        path: { slug, noticeId },
        throwOnError: true,
      });
    },

    onSuccess: (_resolved, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
