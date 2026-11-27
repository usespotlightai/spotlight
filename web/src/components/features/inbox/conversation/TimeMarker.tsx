import { openedAt } from '@/lib/inbox';

export function TimeMarker({ at }: { at: string }) {
  return (
    <time
      dateTime={at}
      className="block text-center text-muted-foreground text-xs"
    >
      {openedAt(at)}
    </time>
  );
}
