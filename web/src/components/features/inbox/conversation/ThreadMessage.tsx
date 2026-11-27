import { HoldMarker } from '@/components/features/inbox/conversation/HoldMarker';
import { PersonMessage } from '@/components/features/inbox/conversation/PersonMessage';
import { WorldMessage } from '@/components/features/inbox/conversation/WorldMessage';
import { useMessageSources } from '@/hooks/api/useMessageSources';
import { marksHold } from '@/lib/hold';
import { authorsOf, type Note } from '@/lib/inbox';

type ThreadMessageProps = {
  note: Note;
  teamId: string | undefined;
};

export function ThreadMessage({ note, teamId }: ThreadMessageProps) {
  const sourceOf = useMessageSources(teamId);

  if (note.voice === 'world') {
    return (
      <WorldMessage
        body={note.body}
        attachments={note.attachments}
        authors={authorsOf(note)}
        source={sourceOf(note.source)}
        deferredTo={note.deferredTo}
      />
    );
  }

  if (marksHold(note)) {
    return <HoldMarker note={note} />;
  }

  return (
    <PersonMessage
      body={note.body}
      attachments={note.attachments}
      authors={authorsOf(note)}
    />
  );
}
