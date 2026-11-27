import type { ReactElement } from 'react';

import type { NoteResumptionResponseDto } from '@/lib/api';
import type { Note } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

const WHERE_IT_WENT: Record<
  NoteResumptionResponseDto['next'],
  (station: string) => string
> = {
  continue: (station) => `It runs again at ${station}.`,
  'move-on': (station) => `It moved to ${station}.`,
  finish: () => 'It is completed.',
};

export function HoldMarker({ note }: { note: Note }): ReactElement {
  const who = note.author?.name ?? 'Someone';

  if (note.form === 'held') {
    return (
      <p
        data-slot="hold-marker"
        className="text-center text-muted-foreground text-xs"
      >
        {who} put the task on hold.
      </p>
    );
  }

  const resumption = note.resumption;

  return (
    <div
      data-slot="hold-marker"
      className="flex flex-col items-center gap-1 text-center text-muted-foreground text-xs"
    >
      <p>
        {who} resumed the line.
        {resumption && ` ${WHERE_IT_WENT[resumption.next](resumption.station)}`}
      </p>
      {nonEmpty(resumption?.summary) && (
        <p className="max-w-prose whitespace-pre-wrap text-foreground text-sm">
          {resumption.summary}
        </p>
      )}
    </div>
  );
}
