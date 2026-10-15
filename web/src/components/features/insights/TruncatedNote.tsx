import { Info } from 'lucide-react';

export function TruncatedNote({ said }: { said: string }) {
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
