import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ADA = UserId.of('user_ada');
const RUN = RunId.of('run_1');

describe('ReviewAuthor', () => {
  it('is a person, an agent, or somebody on GitHub, and never two of them', () => {
    expect(ReviewAuthor.person(ADA, AuthorName.of('Ada')).kind).toBe('person');
    expect(ReviewAuthor.agent(RUN).kind).toBe('agent');
    expect(ReviewAuthor.onGitHub('octocat').kind).toBe('github');
    expect(() =>
      ReviewAuthor.rehydrate({
        userId: ADA,
        runId: RUN,
        login: null,
        name: AuthorName.of('Ada'),
      }),
    ).toThrow(InconsistentStateError);
  });

  it('is somebody in Spotlight only as a person or an agent', () => {
    expect(ReviewAuthor.person(ADA, AuthorName.of('Ada')).inSpotlight).toBe(
      true,
    );
    expect(ReviewAuthor.agent(RUN).inSpotlight).toBe(true);
    expect(ReviewAuthor.onGitHub('octocat').inSpotlight).toBe(false);
  });

  it('is the same author as the same person, or as any agent, since every agent is Spotlight, and nobody on GitHub is', () => {
    const ada = ReviewAuthor.person(ADA, AuthorName.of('Ada'));
    const review = ReviewAuthor.agent(RUN);

    expect(ada.isSameAs(ReviewAuthor.person(ADA, AuthorName.of('A.')))).toBe(
      true,
    );
    expect(review.isSameAs(ReviewAuthor.agent(RUN))).toBe(true);
    expect(review.isSameAs(ReviewAuthor.agent(RunId.of('run_2')))).toBe(true);
    expect(ada.isSameAs(review)).toBe(false);
    expect(
      ReviewAuthor.onGitHub('octocat').isSameAs(
        ReviewAuthor.onGitHub('octocat'),
      ),
    ).toBe(false);
  });

  it('names an agent Spotlight', () => {
    expect(ReviewAuthor.agent(RUN).name.value).toBe('Spotlight');
  });

  it('reads back as what it was written as', () => {
    for (const author of [
      ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      ReviewAuthor.agent(RUN),
      ReviewAuthor.onGitHub('octocat'),
    ]) {
      expect(
        ReviewAuthor.rehydrate({
          userId: author.userId,
          runId: author.runId,
          login: author.login,
          name: author.name,
        }).equals(author),
      ).toBe(true);
    }
  });
});
