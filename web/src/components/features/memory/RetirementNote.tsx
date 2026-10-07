import { PersonNote } from '@/components/features/memory/PersonNote';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { ChatBubble } from '@/components/shared/ChatBubble';
import type { TeamMemory } from '@/lib/memory';
import { since } from '@/lib/since';

type RetirementNoteProps = {
  retirement: NonNullable<TeamMemory['retirement']>;
};

export function RetirementNote({ retirement }: RetirementNoteProps) {
  if (retirement.supersededBy) {
    return <p>Replaced by a newer memory.</p>;
  }

  const by = {
    name: retirement.by?.name ?? 'Someone',
    image: retirement.by?.image ?? null,
  };

  return (
    <figure aria-label="Why it was retired">
      <PersonNote
        avatar={<PersonAvatar person={by} size="md" />}
        name={by.name}
        about={
          <>
            <span className="text-muted-foreground">retired this</span>
            <span className="text-faint">{since(retirement.at)}</span>
          </>
        }
      >
        <ChatBubble>{retirement.reason ?? 'No reason given.'}</ChatBubble>
      </PersonNote>
    </figure>
  );
}
