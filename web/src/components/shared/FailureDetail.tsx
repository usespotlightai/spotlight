import type { ReactElement } from 'react';

import type { SentRequest } from '@/lib/request-failure';

type FailureDetailProps = {
  message: string | null;
  sent: SentRequest | null;
};

export function FailureDetail({
  message,
  sent,
}: FailureDetailProps): ReactElement {
  return (
    <span className="flex flex-col gap-1">
      {message !== null && message !== '' && (
        <span className="break-words">{message}</span>
      )}
      {sent && (
        <code className="break-all font-mono text-xs text-muted-foreground">
          {sent.method} {sent.path}
        </code>
      )}
    </span>
  );
}
