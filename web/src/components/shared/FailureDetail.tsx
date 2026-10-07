import type { SentRequest } from '@/lib/request-failure';

type FailureDetailProps = {
  said: string | null;
  sent: SentRequest | null;
};

export function FailureDetail({ said, sent }: FailureDetailProps) {
  return (
    <span className="flex flex-col gap-1">
      {said && <span className="break-words">{said}</span>}
      {sent && (
        <code className="break-all font-mono text-[0.7rem] text-muted-foreground">
          {sent.method} {sent.path}
        </code>
      )}
    </span>
  );
}
