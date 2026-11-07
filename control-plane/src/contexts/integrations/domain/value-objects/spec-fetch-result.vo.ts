import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class SpecFetchResult {
  private constructor(
    readonly fingerprint: string,
    readonly hash: ContentHash | null,
    readonly readAt: Date,
    readonly problem: string | null,
    readonly skipped: readonly string[],
  ) {}

  static read(input: {
    spec: ApiSpec;
    hash: ContentHash;
    readAt: Date;
    skipped?: readonly string[];
  }): SpecFetchResult {
    return new SpecFetchResult(
      input.spec.fingerprint,
      input.hash,
      input.readAt,
      null,
      input.skipped ?? [],
    );
  }

  static failed(input: {
    spec: ApiSpec;
    readAt: Date;
    problem: string;
  }): SpecFetchResult {
    const problem = input.problem.trim();

    if (problem === '') {
      throw new InvalidIntegrationPartError(
        input.spec.kind,
        'could not be read, and says nothing about why',
      );
    }

    return new SpecFetchResult(
      input.spec.fingerprint,
      null,
      input.readAt,
      problem,
      [],
    );
  }

  static unread(input: {
    spec: ApiSpec;
    readAt: Date;
    problem: string;
    kept: {
      readonly earlier: SpecFetchResult;
      readonly skipped: readonly string[];
    } | null;
  }): SpecFetchResult {
    return input.kept
      ? input.kept.earlier
          .stillAfter(input.problem)
          .withSkipped(input.kept.skipped)
      : SpecFetchResult.failed(input);
  }

  static rehydrate(input: {
    fingerprint: string;
    hash: ContentHash | null;
    readAt: Date;
    problem: string | null;
    skipped: readonly string[];
  }): SpecFetchResult {
    if (input.problem !== null && input.problem.trim() === '') {
      throw new InconsistentStateError(
        'spec fetch',
        'stores a failed fetch that says nothing about why',
      );
    }

    if (!input.hash && input.problem === null) {
      throw new InconsistentStateError(
        'spec fetch',
        'stores a fetch that neither read a spec nor failed',
      );
    }

    return new SpecFetchResult(
      input.fingerprint,
      input.hash,
      input.readAt,
      input.problem,
      [...new Set(input.skipped)],
    );
  }

  stillAfter(problem: string): SpecFetchResult {
    const trimmed = problem.trim();

    if (trimmed === '' || !this.hash) {
      throw new InvalidIntegrationPartError(
        'spec fetch',
        'keeps the earlier spec only when an earlier fetch succeeded, and says why the new fetch failed',
      );
    }

    return new SpecFetchResult(
      this.fingerprint,
      this.hash,
      this.readAt,
      trimmed,
      this.skipped,
    );
  }

  readAgainAt(at: Date): SpecFetchResult {
    return new SpecFetchResult(
      this.fingerprint,
      this.hash,
      at,
      this.problem,
      this.skipped,
    );
  }

  isOf(spec: ApiSpec): boolean {
    return this.fingerprint === spec.fingerprint;
  }

  documentKeptFor(spec: ApiSpec): ContentHash | null {
    return this.isOf(spec) ? this.hash : null;
  }

  spareReadingFor(spec: ApiSpec): boolean {
    return this.documentKeptFor(spec) !== null && this.problem === null;
  }

  sameReadingAs(other: SpecFetchResult): boolean {
    return (
      this.fingerprint === other.fingerprint &&
      (this.hash?.value ?? null) === (other.hash?.value ?? null) &&
      this.problem === other.problem
    );
  }

  withSkipped(skipped: readonly string[]): SpecFetchResult {
    return new SpecFetchResult(
      this.fingerprint,
      this.hash,
      this.readAt,
      this.problem,
      [...new Set(skipped)],
    );
  }
}
