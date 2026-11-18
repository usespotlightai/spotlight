import { marksHold } from '@/lib/hold';
import type { Note } from '@/lib/inbox';

const said = (note: Note): boolean =>
  note.body.trim() !== '' || note.attachments.length > 0;

export const showsMessage = (note: Note): boolean =>
  note.voice === 'world' || marksHold(note) || said(note);
