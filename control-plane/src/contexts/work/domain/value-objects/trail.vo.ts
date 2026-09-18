import type { TaskNote } from '@work/domain/entities/task-note.entity';
import {
  awaitsAPerson,
  type Conversation,
  conversationsOf,
  notesIn,
  owedIn,
  stillOpen,
} from '@work/domain/services/conversations';
import type { NotePosition } from '@work/domain/value-objects/note-position.vo';

export class Trail {
  private constructor(readonly notes: readonly TaskNote[]) {}

  static of(notes: readonly TaskNote[]): Trail {
    return new Trail(notes);
  }

  get awaitsAPerson(): boolean {
    return awaitsAPerson(this.notes);
  }

  get owed(): Conversation | null {
    return owedIn(this.notes);
  }

  get open(): Conversation | null {
    const cut = conversationsOf(this.notes.map((each) => each.kind));
    const last = cut[cut.length - 1];

    return last && stillOpen(last) ? last : null;
  }

  within(from: NotePosition): readonly TaskNote[] | null {
    const conversation = conversationsOf(
      this.notes.map((each) => each.kind),
    ).find((each) => each.from === from.value);

    return conversation ? notesIn(conversation, this.notes) : null;
  }

  get undelivered(): readonly TaskNote[] {
    return this.notes.filter((each) => each.undelivered);
  }
}
