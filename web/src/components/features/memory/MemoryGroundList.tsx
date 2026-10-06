import { Bot, HatGlasses, User } from 'lucide-react';
import { PersonNote } from '@/components/features/memory/PersonNote';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { IconAvatar } from '@/components/shared/avatar/IconAvatar';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { ChatBubble } from '@/components/shared/ChatBubble';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import {
  type MemoryGround,
  type MemoryGroundNote,
  speakerOf,
} from '@/lib/memory';

const noteAvatar = (note: MemoryGroundNote) => {
  if (note.author) {
    return (
      <PersonAvatar
        size="md"
        person={{ name: note.author.name ?? '?', image: note.author.image }}
      />
    );
  }

  return (
    <IconAvatar size="md">
      {note.by === 'world' ? <HatGlasses aria-hidden /> : <User aria-hidden />}
    </IconAvatar>
  );
};

export function MemoryGroundList({ grounds }: { grounds: MemoryGround }) {
  const { data: harnesses } = useHarnesses();
  const agent = harnesses?.find((each) => each.id === grounds.harness)?.name;

  return (
    <ol className="flex flex-col gap-3">
      {grounds.notes.map((note) => (
        <li key={`note-${note.position}`}>
          <PersonNote avatar={noteAvatar(note)} name={speakerOf(note)}>
            <ChatBubble>{note.text}</ChatBubble>
          </PersonNote>
        </li>
      ))}
      {grounds.steps.map((step) => (
        <li key={`step-${step.index}`}>
          <PersonNote
            name={agent ?? 'The agent'}
            avatar={
              <IconAvatar size="md">
                {grounds.harness ? (
                  <HarnessLogo harness={grounds.harness} />
                ) : (
                  <Bot aria-hidden />
                )}
              </IconAvatar>
            }
          >
            <ChatBubble>{step.text}</ChatBubble>
          </PersonNote>
        </li>
      ))}
    </ol>
  );
}
