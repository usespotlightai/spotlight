import {
  awaitsAPerson,
  type Conversation,
  conversationsOf,
  notesIn,
  owedIn,
  stillOpen,
} from '@domain/services/conversations';
import type { NotePosition } from '@domain/value-objects/note-position.vo';
import type { TaskNote } from '@domain/value-objects/task-note.vo';

export class Trail {
  private constructor(readonly notes: readonly TaskNote[]) {}

  static of(notes: readonly TaskNote[]): Trail {
    return new Trail(notes);
  }

  static empty(): Trail {
    return new Trail([]);
  }

  with(note: TaskNote): Trail {
    return new Trail([...this.notes, note]);
  }

  get last(): TaskNote | null {
    return this.notes[this.notes.length - 1] ?? null;
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

  marked(change: (note: TaskNote) => TaskNote): Trail {
    return new Trail(this.notes.map(change));
  }

  equals(other: Trail): boolean {
    return (
      this.notes.length === other.notes.length &&
      this.notes.every((each, index) => each.equals(other.notes[index]))
    );
  }
}
