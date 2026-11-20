import { useEffect, useRef } from 'react';

import { useVerifyMyEmail } from '@/hooks/api/useVerifyMyEmail';

export function useVerifyOnSignIn(
  token: string | undefined,
  signedIn: boolean,
) {
  const verify = useVerifyMyEmail(token);
  const started = useRef<string | null>(null);

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
