import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { readInboxNotice } from '@/lib/api';

type ReadInboxNoticeInput = {
  slug: string;
  noticeId: string;
};

export function useReadInboxNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, noticeId }: ReadInboxNoticeInput) => {
      await readInboxNotice({ path: { slug, noticeId }, throwOnError: true });
    },

    onSuccess: (_read, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
