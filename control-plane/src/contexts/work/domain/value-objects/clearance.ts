import type { NotePosition } from '@work/domain/value-objects/note-position.vo';

export type Clearance =
  | { readonly kind: 'given'; readonly claimed: NotePosition }
  | { readonly kind: 'asked' }
  | { readonly kind: 'refused'; readonly reason: string };
