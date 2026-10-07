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
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md';

const noteAvatar = (note: MemoryGroundNote, size: AvatarSize) => {
  if (note.author) {
    return (
      <PersonAvatar
        size={size}
        person={{ name: note.author.name ?? '?', image: note.author.image }}
      />
    );
  }

  return (
    <IconAvatar size={size}>
      {note.by === 'world' ? <HatGlasses aria-hidden /> : <User aria-hidden />}
    </IconAvatar>
  );
};

type MemoryGroundListProps = {
  grounds: MemoryGround;
  compact?: boolean;
};

export function MemoryGroundList({
  grounds,
  compact = false,
}: MemoryGroundListProps) {
  const { data: harnesses } = useHarnesses();
  const agent = harnesses?.find((each) => each.id === grounds.harness)?.name;
  const size: AvatarSize = compact ? 'sm' : 'md';
  const said = [
    ...grounds.notes.map((note) => ({
      key: `note-${note.position}`,
      name: speakerOf(note),
      avatar: noteAvatar(note, size),
      text: note.text,
    })),
    ...grounds.steps.map((step) => ({
      key: `step-${step.index}`,
      name: agent ?? 'The agent',
      avatar: (
        <IconAvatar size={size}>
          {grounds.harness ? (
            <HarnessLogo harness={grounds.harness} />
          ) : (
            <Bot aria-hidden />
          )}
        </IconAvatar>
      ),
      text: step.text,
    })),
  ];

  return (
    <ol className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
      {said.map((each) => (
        <li key={each.key}>
          {compact ? (
            <div className="flex flex-col gap-0.5 text-xs leading-5">
              <div className="flex items-center gap-2.5">
                {each.avatar}
                <span className="min-w-0 truncate text-muted-foreground">
                  {each.name}
                </span>
              </div>
              <p className="pl-8.5 text-foreground">{each.text}</p>
            </div>
          ) : (
            <PersonNote avatar={each.avatar} name={each.name}>
              <ChatBubble>{each.text}</ChatBubble>
            </PersonNote>
          )}
        </li>
      ))}
    </ol>
  );
}
