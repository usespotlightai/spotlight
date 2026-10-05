import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';

export class SourceReading {
  private constructor(
    readonly fingerprint: string,
    readonly hash: ContentHash | null,
    readonly readAt: Date,
    readonly problem: string | null,
    readonly passedOver: readonly string[],
  ) {}

  static read(input: {
    source: DescribedSource;
    hash: ContentHash;
    readAt: Date;
    passedOver?: readonly string[];
  }): SourceReading {
    return new SourceReading(
      input.source.fingerprint,
      input.hash,
      input.readAt,
      null,
      input.passedOver ?? [],
    );
  }

  static failed(input: {
    source: DescribedSource;
    readAt: Date;
    problem: string;
  }): SourceReading {
    const problem = input.problem.trim();

    if (problem === '') {
      throw new InvalidIntegrationPartError(
        input.source.kind,
        'could not be read, and says nothing about why',
      );
    }

    return new SourceReading(
      input.source.fingerprint,
      null,
      input.readAt,
      problem,
      [],
    );
  }

  static rehydrate(input: {
    fingerprint: string;
    hash: ContentHash | null;
    readAt: Date;
    problem: string | null;
    passedOver: readonly string[];
  }): SourceReading {
    return new SourceReading(
      input.fingerprint,
      input.hash,
      input.readAt,
      input.problem,
      input.passedOver,
    );
  }

  stillAfter(problem: string): SourceReading {
    const said = problem.trim();

    if (said === '' || !this.hash) {
      throw new InvalidIntegrationPartError(
        'reading',
        'keeps what it read before only when it read something, and says why it could not read it again',
      );
    }

    return new SourceReading(
      this.fingerprint,
      this.hash,
      this.readAt,
      said,
      this.passedOver,
    );
  }

  isOf(source: DescribedSource): boolean {
    return this.fingerprint === source.fingerprint;
  }

  passingOver(passedOver: readonly string[]): SourceReading {
    return new SourceReading(
      this.fingerprint,
      this.hash,
      this.readAt,
      this.problem,
      [...new Set(passedOver)],
    );
  }
}
