import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';

const MOVE_MAKERS = ['line', 'person', 'run'] as const;

export type MoveMaker = (typeof MOVE_MAKERS)[number];

const isMoveMaker = (raw: string): raw is MoveMaker =>
  (MOVE_MAKERS as readonly string[]).includes(raw);

export class NoteMove {
  private constructor(
    readonly to: StationId,
    readonly by: MoveMaker,
  ) {}

  static to(to: StationId, by: MoveMaker): NoteMove {
    return new NoteMove(to, by);
  }

  static of(to: StationId, by: string): NoteMove {
    if (!isMoveMaker(by)) {
      throw new InvalidTaskNoteError(`names an unknown mover ${by}`);
    }

    return new NoteMove(to, by);
  }

  // A run that passes the task on already shows as a run.
  get madeOutsideARun(): boolean {
    return this.by !== 'run';
  }

  equals(other: NoteMove): boolean {
    return this.to.equals(other.to) && this.by === other.by;
  }
}
