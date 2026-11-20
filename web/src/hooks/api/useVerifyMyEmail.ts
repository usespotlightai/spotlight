import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { myEmailKeys } from '@/hooks/api/useMyEmails';
import { verifyMyEmail } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useVerifyMyEmail(token: string | undefined, signedIn: boolean) {
  const queryClient = useQueryClient();
  const started = useRef<string | null>(null);

  const verify = useMutation({
    meta: { quiet: true },
    mutationFn: async () => {
      const { data, error, response } = await verifyMyEmail({
        path: { token: token as string },
      });

      if (data) {
        return data;
      }

      if (response?.status === 404) {
        throw new Error(
          'The verification link doesn’t work. Please send a new one from your settings.',
        );
      }

      throw new Error(
        messageOf(error, 'Sorry, the email couldn’t be verified.'),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: myEmailKeys.all }),
  });

  useEffect(() => {
    if (!signedIn || !token || started.current === token) {
      return;
    }

    started.current = token;
    verify.reset();
    verify.mutate();
  }, [signedIn, token, verify]);

  return verify;
}
