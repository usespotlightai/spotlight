import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { settleInboxNotice } from '@/lib/api';

type SettleInboxNoticeInput = {
  slug: string;
  noticeId: string;
};

export function useSettleInboxNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, noticeId }: SettleInboxNoticeInput) => {
      await settleInboxNotice({ path: { slug, noticeId }, throwOnError: true });
    },

    onSuccess: (_settled, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
