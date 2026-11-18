import type { FoldedVisitDto, NoteDto } from '@work/application/dto/inbox.dto';
import type {
  InboxFoldedVisit,
  InboxNote,
} from '@work/application/ports/inbox-reader.port';

export const NoteMapper = {
  toDto: (note: InboxNote): NoteDto => ({
    ...note,
    at: note.at.toISOString(),
  }),

  foldedToDto: (visit: InboxFoldedVisit): FoldedVisitDto => ({
    ...visit,
    notes: visit.notes.map(NoteMapper.toDto),
  }),
};
