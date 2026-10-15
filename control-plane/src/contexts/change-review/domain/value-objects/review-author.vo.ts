import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type ReviewAuthorKind = 'person' | 'agent' | 'github';

export class ReviewAuthor {
  private constructor(
    readonly kind: ReviewAuthorKind,
    readonly userId: UserId | null,
    readonly runId: RunId | null,
    readonly login: string | null,
    readonly name: AuthorName,
  ) {}

  static person(userId: UserId, name: AuthorName): ReviewAuthor {
    return new ReviewAuthor('person', userId, null, null, name);
  }

  static agent(runId: RunId): ReviewAuthor {
    return new ReviewAuthor('agent', null, runId, null, AuthorName.spotlight());
  }

  static onGitHub(login: string | null): ReviewAuthor {
    return new ReviewAuthor(
      'github',
      null,
      null,
      login?.trim() || null,
      AuthorName.onGitHub(login),
    );
  }

  static rehydrate(input: {
    userId: UserId | null;
    runId: RunId | null;
    login: string | null;
    name: AuthorName;
  }): ReviewAuthor {
    if (input.userId && input.runId) {
      throw new InconsistentStateError(
        'review author',
        'is both a person and an agent',
      );
    }

    if (input.userId) {
      return ReviewAuthor.person(input.userId, input.name);
    }

    if (input.runId) {
      return ReviewAuthor.agent(input.runId);
    }

    return new ReviewAuthor('github', null, null, input.login, input.name);
  }

  get inSpotlight(): boolean {
    return this.kind !== 'github';
  }

  // Every agent reviews as Spotlight, so a run can continue what another run left.
  isSameAs(other: ReviewAuthor): boolean {
    if (this.kind !== other.kind || !this.inSpotlight) {
      return false;
    }

    return this.kind === 'agent'
      ? true
      : (this.userId?.equals(other.userId as UserId) ?? false);
  }

  equals(other: ReviewAuthor): boolean {
    return (
      this.kind === other.kind &&
      this.login === other.login &&
      this.name.equals(other.name) &&
      (this.userId?.equals(other.userId as UserId) ?? other.userId === null) &&
      (this.runId?.equals(other.runId as RunId) ?? other.runId === null)
    );
  }
}
