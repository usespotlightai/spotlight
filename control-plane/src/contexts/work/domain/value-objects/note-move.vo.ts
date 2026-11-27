import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';

const MOVE_MAKERS = ['line', 'person', 'run'] as const;

export type MoveMaker = (typeof MOVE_MAKERS)[number];

const isMoveMaker = (raw: string): raw is MoveMaker =>
  (MOVE_MAKERS as readonly string[]).includes(raw);

export type Mover =
  | { readonly by: 'line'; readonly why: string | null }
  | {
      readonly by: 'person';
      readonly who: UserId | null;
      readonly why: string | null;
    }
  | { readonly by: 'run' };

export const BY_A_RUN: Mover = { by: 'run' };

export const byTheLine = (why: string | null = null): Mover => ({
  by: 'line',
  why,
});

export const byAPerson = (
  who: UserId | null,
  why: string | null = null,
): Mover => ({ by: 'person', who, why });

const said = (why: string | null | undefined): string | null => {
  const trimmed = why?.trim();

  return nonEmpty(trimmed) ? trimmed : null;
};

export class NoteMove {
  private constructor(
    readonly to: StationId,
    readonly by: MoveMaker,
    readonly who: UserId | null,
    readonly why: string | null,
  ) {}

  static to(to: StationId, mover: Mover): NoteMove {
    switch (mover.by) {
      case 'run':
        return new NoteMove(to, 'run', null, null);
      case 'line':
        return new NoteMove(to, 'line', null, said(mover.why));
      case 'person':
        return new NoteMove(to, 'person', mover.who, said(mover.why));
    }
  }

  static rehydrate(input: {
    to: string;
    by: string;
    who?: string | null;
    why?: string | null;
  }): NoteMove {
    if (!isMoveMaker(input.by)) {
      throw new InvalidTaskNoteError(`names an unknown mover ${input.by}`);
    }

    if (nonEmpty(input.who) && input.by !== 'person') {
      throw new InvalidTaskNoteError(
        `names a person on a move by the ${input.by}`,
      );
    }

    return new NoteMove(
      StationId.of(input.to),
      input.by,
      nonEmpty(input.who) ? UserId.of(input.who) : null,
      said(input.why),
    );
  }

  // A run that passes the task on already shows as a run.
  get madeOutsideARun(): boolean {
    return this.by !== 'run';
  }

  equals(other: NoteMove): boolean {
    return (
      this.to.equals(other.to) &&
      this.by === other.by &&
      (this.who?.value ?? null) === (other.who?.value ?? null) &&
      this.why === other.why
    );
  }
}
