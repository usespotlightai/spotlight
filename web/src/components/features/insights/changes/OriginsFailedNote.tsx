import { Info } from 'lucide-react';

export function OriginsFailedNote({ onRetry }: { onRetry: () => void }) {
  return (
    <p
      role="note"
      className="flex items-center gap-1.5 text-muted-foreground text-xs"
    >
      <Info aria-hidden className="size-3.5 shrink-0" />
      Sorry, which candidate each change came from could not be loaded.
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer text-foreground hover:underline"
      >
        Try again
      </button>
    </p>
  );
}
