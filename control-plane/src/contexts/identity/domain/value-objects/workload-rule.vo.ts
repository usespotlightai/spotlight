import { InvalidTokenTrustError } from '@identity/domain/exceptions/invalid-token-trust.error';
import { ClaimPattern } from '@identity/domain/value-objects/claim-pattern.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';

const LONGEST = 255;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

const CLAIM_NAME = /^[a-z][a-z0-9_]{0,63}$/;

const REGISTERED = new Set(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);

const MAX_CLAIMS = 16;

const OWNER_END = '/';

export class WorkloadRule {
  private readonly kind = 'workload-rule';

  private constructor(
    readonly issuer: string,
    readonly audience: string,
    readonly subject: ClaimPattern,
    private readonly claimed: ReadonlyMap<string, ClaimPattern>,
  ) {}

  static issuerOf(raw: string): string {
    const trimmed = raw.trim();
    const invalid = new InvalidTokenTrustError(
      'issuer',
      'must be an https URL with no query or fragment, as in https://token.actions.githubusercontent.com',
    );
    let url: URL;

    try {
      url = new URL(trimmed);
    } catch {
      throw invalid;
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
      throw invalid;
    }

    return trimmed;
  }

  static audienceOf(raw: string): string {
    const trimmed = raw.trim();

    if (!trimmed || trimmed.length > LONGEST || /\s/.test(trimmed)) {
      throw new InvalidTokenTrustError(
        'audience',
        `must be one word of at most ${LONGEST} characters, as in spotlight`,
      );
    }

    return trimmed;
  }

  static claimNameOf(raw: string): string {
    if (!CLAIM_NAME.test(raw) || REGISTERED.has(raw)) {
      throw new InvalidTokenTrustError(
        'claims',
        `must be lowercase letters, digits and underscores, other than ${[...REGISTERED].join(', ')}, as in workflow_ref`,
      );
    }

    return raw;
  }

  static of(input: {
    issuer: string;
    audience: string;
    subject: string;
    claims: Readonly<Record<string, string>>;
  }): WorkloadRule {
    const named = Object.entries(input.claims);

    if (named.length > MAX_CLAIMS) {
      throw new InvalidTokenTrustError(
        'claims',
        `must name at most ${MAX_CLAIMS} claims`,
      );
    }

    const claimed = new Map(
      named.map(([name, pattern]): [string, ClaimPattern] => [
        WorkloadRule.claimNameOf(name),
        ClaimPattern.of(pattern, `claims.${name}`),
      ]),
    );
    const subject = ClaimPattern.of(input.subject);

    if (!subject.isExact && !subject.literalStart.includes(OWNER_END)) {
      throw new InvalidTokenTrustError(
        'subject',
        'must name an owner before any *, as in repo:acme/* or repo:acme/platform:*',
      );
    }

    return new WorkloadRule(
      WorkloadRule.issuerOf(input.issuer),
      WorkloadRule.audienceOf(input.audience),
      subject,
      claimed,
    );
  }

  get claims(): Readonly<Record<string, string>> {
    return Object.fromEntries(
      [...this.claimed].map(([name, pattern]) => [name, pattern.value]),
    );
  }

  matches(workload: WorkloadClaims): boolean {
    const named = new Map(Object.entries(workload.named));

    return (
      workload.issuer === this.issuer &&
      workload.audiences.includes(this.audience) &&
      this.subject.matches(workload.subject) &&
      [...this.claimed].every(([name, pattern]) => {
        const claimed = named.get(name);

        return typeof claimed === 'string' && pattern.matches(claimed);
      })
    );
  }

  equals(other: WorkloadRule): boolean {
    return (
      this.kind === other.kind &&
      this.issuer === other.issuer &&
      this.audience === other.audience &&
      this.subject.equals(other.subject) &&
      this.claimed.size === other.claimed.size &&
      [...this.claimed].every(
        ([name, pattern]) => other.claimed.get(name)?.equals(pattern) ?? false,
      )
    );
  }
}
