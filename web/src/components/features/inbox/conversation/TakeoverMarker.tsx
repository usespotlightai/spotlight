import type { Note } from '@/lib/inbox';

export function TakeoverMarker({ note }: { note: Note }) {
  const who = note.author?.name ?? 'Someone';

  return (
    <p
      data-slot="takeover-marker"
      className="text-center text-muted-foreground text-xs"
    >
      {note.form === 'took-over'
        ? `${who} took over the task`
        : `${who} gave the task back to the line`}
    </p>
  );
}
