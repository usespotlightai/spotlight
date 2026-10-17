import type { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export type ApprovalCheck =
  | {
      readonly kind: 'given';
      readonly claimed: NotePosition;
      readonly edited: ToolInputs | null;
    }
  | { readonly kind: 'asked' }
  | { readonly kind: 'refused'; readonly reason: string };
