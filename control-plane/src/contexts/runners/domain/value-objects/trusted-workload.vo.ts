import { InvalidTrustedWorkloadError } from '@runners/domain/exceptions/invalid-trusted-workload.error';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';

const LONGEST = 255;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

const bounded = (
  field: 'subject' | 'audience',
  raw: string,
  example: string,
): string => {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.length > LONGEST || /\s/.test(trimmed)) {
    throw new InvalidTrustedWorkloadError(
      field,
      `must be one word of at most ${LONGEST} characters, as in ${example}`,
    );
  }

  return trimmed;
};

export class TrustedWorkload {
  private readonly kind = 'trusted-workload' as const;

  private constructor(
    readonly issuer: string,
    readonly subject: string,
    readonly audience: string,
  ) {}

  static issuerOf(raw: string): string {
    const trimmed = raw.trim();
    const refused = new InvalidTrustedWorkloadError(
      'issuer',
      'must be the https URL the platform signs its tokens as, with no query or fragment',
    );
    let url: URL;

    try {
      url = new URL(trimmed);
    } catch {
      throw refused;
    }

    const secure =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOOPBACK.has(url.hostname));

    if (
      !secure ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      trimmed.length > LONGEST
    ) {
      throw refused;
    }

    return trimmed;
  }

  static subjectOf(raw: string): string {
    return bounded('subject', raw, 'system:serviceaccount:spotlight:runner');
  }

  static audienceOf(raw: string): string {
    return bounded('audience', raw, 'spotlight');
  }

  static of(input: {
    issuer: string;
    subject: string;
    audience: string;
  }): TrustedWorkload {
    return new TrustedWorkload(
      TrustedWorkload.issuerOf(input.issuer),
      TrustedWorkload.subjectOf(input.subject),
      TrustedWorkload.audienceOf(input.audience),
    );
  }

  admits(claims: WorkloadClaims): boolean {
    return (
      claims.issuer === this.issuer &&
      claims.subject === this.subject &&
      claims.audiences.includes(this.audience)
    );
  }

  equals(other: TrustedWorkload): boolean {
    return (
      this.kind === other.kind &&
      this.issuer === other.issuer &&
      this.subject === other.subject &&
      this.audience === other.audience
    );
  }
}
