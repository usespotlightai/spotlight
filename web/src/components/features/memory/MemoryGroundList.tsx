import { Bot, HatGlasses, User } from 'lucide-react';
import { ThreadEntry } from '@/components/features/review/ThreadEntry';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { IconAvatar } from '@/components/shared/avatar/IconAvatar';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import {
  authorOf,
  type MemoryGround,
  type MemoryGroundNote,
} from '@/lib/memory';

const noteAvatar = (note: MemoryGroundNote) => {
  if (note.author) {
    return (
      <PersonAvatar
        person={{ name: note.author.name ?? '?', image: note.author.image }}
      />
    );
  }

  return (
    <IconAvatar>
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
  const entries = [
    ...grounds.notes.map((note) => ({
      key: `note-${note.position}`,
      name: authorOf(note),
      avatar: noteAvatar(note),
      text: note.text,
    })),
    ...grounds.steps.map((step) => ({
      key: `step-${step.index}`,
      name: agent ?? 'The agent',
      avatar: (
        <IconAvatar>
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

  if (!compact) {
    return (
      <ol className="flex flex-col">
        {entries.map((each, at) => (
          <ThreadEntry
            key={each.key}
            first={at === 0}
            avatar={each.avatar}
            author={each.name}
          >
            <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
              {each.text}
            </p>
          </ThreadEntry>
        ))}
      </ol>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((each) => (
        <li key={each.key}>
          <div className="flex flex-col gap-0.5 text-xs leading-5">
            <div className="flex items-center gap-2.5">
              {each.avatar}
              <span className="min-w-0 truncate text-muted-foreground">
                {each.name}
              </span>
            </div>
            <p className="pl-8.5 text-foreground">{each.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
