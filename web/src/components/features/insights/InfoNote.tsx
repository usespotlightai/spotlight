import { Info } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';

export function InfoNote({ note }: { note: string }) {
  return (
    <Noted note={note}>
      <span className="inline-flex text-muted-foreground hover:text-foreground">
        <Info aria-hidden className="size-3.5" />
      </span>
    </Noted>
  );
}
