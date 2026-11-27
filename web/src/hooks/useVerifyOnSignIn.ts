import type { UseMutationResult } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useVerifyMyEmail } from '@/hooks/api/useVerifyMyEmail';
import type { UserEmailResponseDto } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';

export function useVerifyOnSignIn(
  token: string | undefined,
  signedIn: boolean,
): UseMutationResult<UserEmailResponseDto, Error, void> {
  const verify = useVerifyMyEmail(token);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn || !nonEmpty(token) || started.current === token) {
      return;
    }

    started.current = token;
    verify.reset();
    verify.mutate();
  }, [signedIn, token, verify]);

  return verify;
}
