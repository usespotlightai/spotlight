import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import {
  StartedCheckout,
  type StartedCheckoutParts,
} from '@work/domain/value-objects/started-checkout.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export interface ReportedStart {
  readonly archive: WorkspaceArchiveId | null;
  readonly checkouts: readonly StartedCheckout[];
}

export interface StartingPointParts {
  readonly archive: string | null;
  readonly checkouts: readonly StartedCheckoutParts[];
  readonly attempt: number;
  readonly at: Date;
}

export const MAX_STARTED_CHECKOUTS = 100;

const byPath = (a: StartedCheckout, b: StartedCheckout): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

export class StartingPoint {
  private constructor(
    readonly archive: WorkspaceArchiveId | null,
    readonly checkouts: readonly StartedCheckout[],
    readonly attempt: number,
    readonly at: Date,
  ) {}

  static of(
    input: ReportedStart & { attempt: number; at: Date },
  ): StartingPoint {
    if (input.checkouts.length > MAX_STARTED_CHECKOUTS) {
      throw new InvalidStartingPointError(
        `can name at most ${MAX_STARTED_CHECKOUTS} checkouts`,
      );
    }

    const paths = input.checkouts.map((each) => each.path);

    if (new Set(paths).size !== paths.length) {
      throw new InvalidStartingPointError('must name each checkout once');
    }

    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new InconsistentStateError(
        'run',
        `started on an attempt it never made (${input.attempt})`,
      );
    }

    return new StartingPoint(
      input.archive,
      [...input.checkouts].sort(byPath),
      input.attempt,
      input.at,
    );
  }

  static rehydrate(parts: StartingPointParts): StartingPoint {
    try {
      return StartingPoint.of({
        archive: parts.archive ? WorkspaceArchiveId.of(parts.archive) : null,
        checkouts: parts.checkouts.map(StartedCheckout.of),
        attempt: parts.attempt,
        at: parts.at,
      });
    } catch (error) {
      if (error instanceof InvalidStartingPointError) {
        throw new InconsistentStateError(
          'run',
          `records where it started in a way that no longer reads: ${error.message}`,
        );
      }

      throw error;
    }
  }

  get paths(): readonly string[] {
    return this.checkouts.map((each) => each.path);
  }

  get parts(): StartingPointParts {
    return {
      archive: this.archive?.value ?? null,
      checkouts: this.checkouts.map((each) => each.parts),
      attempt: this.attempt,
      at: this.at,
    };
  }

  sameAs(reported: ReportedStart): boolean {
    const checkouts = [...reported.checkouts].sort(byPath);

    return (
      (this.archive === null
        ? reported.archive === null
        : reported.archive !== null && this.archive.equals(reported.archive)) &&
      checkouts.length === this.checkouts.length &&
      checkouts.every((each, at) => this.checkouts[at]?.equals(each))
    );
  }

  equals(other: StartingPoint): boolean {
    return (
      this.sameAs(other) &&
      this.attempt === other.attempt &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
