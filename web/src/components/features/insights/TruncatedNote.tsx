import { Info } from 'lucide-react';
import { TRUNCATED } from '@/lib/insights';

export function TruncatedNote({ said = TRUNCATED }: { said?: string }) {
  return (
    <p
      role="note"
      className="flex items-center gap-1.5 text-muted-foreground text-xs"
    >
      <Info aria-hidden className="size-3.5 shrink-0" />
      {said}
    </p>
  );
}
