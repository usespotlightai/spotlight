import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unsubscribeFromPush } from '@/lib/api';
import { authClient } from '@/lib/authClient';
import { currentPushSubscription } from '@/lib/notifications';
import { forgetQueryCache } from '@/lib/query-cache';

const withoutPush = async () => {
  const subscription = await currentPushSubscription();

  if (!subscription) {
    return;
  }

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await unsubscribeFromPush({ body: { endpoint } });
};

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['auth', 'sign-out'],
    mutationFn: async () => {
      await withoutPush().catch(() => undefined);
      const { error } = await authClient.signOut();
      if (error) {
        throw new Error(
          error.message ?? 'Sorry, sign-out failed. Please try again.',
        );
      }
    },
    onSuccess: async () => {
      queryClient.clear();
      await forgetQueryCache();
    },
  });
}
