import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TooManyCoAuthorsError } from '@work/domain/exceptions/too-many-co-authors.error';

const MAX_CO_AUTHORS = 20;

export class CoAuthors {
  private constructor(readonly named: readonly UserId[]) {}

  static named(ids: readonly UserId[]): CoAuthors {
    const once = ids.filter(
      (each, at) => ids.findIndex((other) => other.equals(each)) === at,
    );

    if (once.length > MAX_CO_AUTHORS) {
      throw new TooManyCoAuthorsError(MAX_CO_AUTHORS);
    }

    return new CoAuthors(once);
  }

  whoWrote(writers: readonly UserId[]): UserId[] {
    return this.named.filter((each) =>
      writers.some((writer) => writer.equals(each)),
    );
  }
}
