import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { NOTE_BOX, PersonNote } from '@/components/features/memory/PersonNote';
import type { TeamMemory } from '@/lib/memory';
import { since } from '@/lib/runner';

type RetirementNoteProps = {
  retirement: NonNullable<TeamMemory['retirement']>;
};

export function RetirementNote({ retirement }: RetirementNoteProps) {
  if (retirement.supersededBy) {
    return <p>Replaced by a newer memory.</p>;
  }

  return (
    <figure aria-label="Why it was retired">
      <PersonNote
        person={{
          name: retirement.by?.name ?? 'Someone',
          image: retirement.by?.image ?? null,
        }}
        about={
          <>
            <span className="text-muted-foreground">retired this</span>
            <span className="text-faint">{since(retirement.at)}</span>
          </>
        }
      >
        <SaidCard className={NOTE_BOX}>
          <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
            {retirement.reason ?? 'No reason given.'}
          </p>
        </SaidCard>
      </PersonNote>
    </figure>
  );
}
