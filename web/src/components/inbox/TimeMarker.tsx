import { openedAt } from '@/lib/inbox';

/** When something happened, set between what came before it and after. */
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
