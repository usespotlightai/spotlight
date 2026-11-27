import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { resolveInboxNotice } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type ResolveInboxNoticeInput = {
  slug: string;
  noticeId: string;
};

export function useResolveInboxNotice(): UseMutationResult<
  void,
  Error,
  ResolveInboxNoticeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { quiet: true },
    mutationFn: async ({ slug, noticeId }: ResolveInboxNoticeInput) => {
      const { response } = await resolveInboxNotice({
        path: { slug, noticeId },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        inboxKeys.forWorkspace(slug),
      ]);
    },
  });
}
