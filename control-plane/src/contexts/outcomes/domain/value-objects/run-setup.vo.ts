import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';

const blank = (text: string): boolean => text.trim().length === 0;

export class RunSetup {
  private constructor(
    readonly harness: string,
    readonly model: string | null,
    readonly effort: string | null,
    readonly profileKey: string | null,
    readonly repositories: readonly string[],
    readonly skills: readonly string[],
  ) {}

  static of(input: {
    harness: string;
    model: string | null;
    effort: string | null;
    profileKey: string | null;
    repositories: readonly string[];
    skills: readonly string[];
  }): RunSetup {
    if (blank(input.harness)) {
      throw new InvalidOutcomeError('must name its harness');
    }
    if (input.repositories.some(blank)) {
      throw new InvalidOutcomeError('must name each repository');
    }
    if (input.skills.some(blank)) {
      throw new InvalidOutcomeError('must name each skill given');
    }

    return new RunSetup(
      input.harness,
      input.model,
      input.effort,
      input.profileKey,
      [...new Set(input.repositories)],
      [...new Set(input.skills)],
    );
  }
}
