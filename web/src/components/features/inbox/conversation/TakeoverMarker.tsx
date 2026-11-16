import type { NoteHandBackResponseDto } from '@/lib/api';
import type { Note } from '@/lib/inbox';

const WHERE_IT_WENT: Record<
  NoteHandBackResponseDto['next'],
  (station: string) => string
> = {
  continue: (station) => `It runs again at ${station}.`,
  'move-on': (station) => `It moved to ${station}.`,
  finish: () => 'It is completed.',
};

export function TakeoverMarker({ note }: { note: Note }) {
  const who = note.author?.name ?? 'Someone';

  if (note.form === 'took-over') {
    return (
      <p
        data-slot="takeover-marker"
        className="text-center text-muted-foreground text-xs"
      >
        {who} took over the task.
      </p>
    );
  }

  const handBack = note.handBack;

  return (
    <div
      data-slot="takeover-marker"
      className="flex flex-col items-center gap-1 text-center text-muted-foreground text-xs"
    >
      <p>
        {who} handed the task back.
        {handBack && ` ${WHERE_IT_WENT[handBack.next](handBack.station)}`}
      </p>
      {handBack?.summary && (
        <p className="max-w-prose whitespace-pre-wrap text-foreground text-sm">
          {handBack.summary}
        </p>
      )}
    </div>
  );
}
