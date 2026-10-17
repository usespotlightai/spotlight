import type { SentRequest } from '@/lib/request-failure';

type FailureDetailProps = {
  message: string | null;
  sent: SentRequest | null;
};

export function FailureDetail({ message, sent }: FailureDetailProps) {
  return (
    <span className="flex flex-col gap-1">
      {message && <span className="break-words">{message}</span>}
      {sent && (
        <code className="break-all font-mono text-[0.7rem] text-muted-foreground">
          {sent.method} {sent.path}
        </code>
      )}
    </span>
  );
}
