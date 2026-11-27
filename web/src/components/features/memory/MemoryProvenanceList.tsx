import { Bot, HatGlasses, User } from 'lucide-react';

import { ThreadEntry } from '@/components/features/review/ThreadEntry';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';
import { IconAvatar } from '@/components/shared/avatar/IconAvatar';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import {
  authorOf,
  type MemoryProvenance,
  type MemoryProvenanceNote,
} from '@/lib/memory';
import { nonEmpty } from '@/lib/non-empty';

const noteAvatar = (note: MemoryProvenanceNote) => {
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

type MemoryProvenanceListProps = {
  provenance: MemoryProvenance;
};

export function MemoryProvenanceList({
  provenance,
}: MemoryProvenanceListProps) {
  const { data: harnesses } = useHarnesses();
  const agent = harnesses?.find((each) => each.id === provenance.harness)?.name;
  const entries = [
    ...provenance.notes.map((note) => ({
      key: `note-${note.position}`,
      name: authorOf(note),
      avatar: noteAvatar(note),
      text: note.text,
    })),
    ...provenance.steps.map((step) => ({
      key: `step-${step.index}`,
      name: agent ?? 'The agent',
      avatar: (
        <IconAvatar>
          {nonEmpty(provenance.harness) ? (
            <HarnessLogo harness={provenance.harness} />
          ) : (
            <Bot aria-hidden />
          )}
        </IconAvatar>
      ),
      text: step.text,
    })),
  ];

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
