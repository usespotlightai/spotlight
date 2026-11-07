import { InvalidOidcTrustError } from '@identity/domain/exceptions/invalid-oidc-trust.error';
import { ClaimPattern } from '@identity/domain/value-objects/claim-pattern.vo';
import { OidcAudience } from '@identity/domain/value-objects/oidc-audience.vo';
import { OidcIssuer } from '@identity/domain/value-objects/oidc-issuer.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';

const CLAIM_NAME = /^[a-z][a-z0-9_]{0,63}$/;

const REGISTERED = new Set(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);

const MAX_CLAIMS = 16;

const OWNER_END = '/';

export class WorkloadRule {
  private readonly kind = 'workload-rule';

  private constructor(
    readonly issuer: OidcIssuer,
    readonly audience: OidcAudience,
    readonly subject: ClaimPattern,
    private readonly claimed: ReadonlyMap<string, ClaimPattern>,
  ) {}

  static claimNameOf(raw: string): string {
    if (!CLAIM_NAME.test(raw) || REGISTERED.has(raw)) {
      throw new InvalidOidcTrustError(
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
    const customClaims = Object.entries(input.claims);

    if (customClaims.length > MAX_CLAIMS) {
      throw new InvalidOidcTrustError(
        'claims',
        `must name at most ${MAX_CLAIMS} claims`,
      );
    }

    const claimed = new Map(
      customClaims.map(([name, pattern]): [string, ClaimPattern] => [
        WorkloadRule.claimNameOf(name),
        ClaimPattern.of(pattern, `claims.${name}`),
      ]),
    );
    const subject = ClaimPattern.of(input.subject);

    if (!subject.isExact && !subject.literalStart.includes(OWNER_END)) {
      throw new InvalidOidcTrustError(
        'subject',
        'must name an owner before any *, as in repo:acme/* or repo:acme/platform:*',
      );
    }

    return new WorkloadRule(
      OidcIssuer.of(input.issuer),
      OidcAudience.of(input.audience),
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
    const customClaims = new Map(Object.entries(workload.customClaims));

    return (
      this.issuer.issued(workload.issuer) &&
      this.audience.among(workload.audiences) &&
      this.subject.matches(workload.subject) &&
      [...this.claimed].every(([name, pattern]) => {
        const claimed = customClaims.get(name);

        return typeof claimed === 'string' && pattern.matches(claimed);
      })
    );
  }

  equals(other: WorkloadRule): boolean {
    return (
      this.kind === other.kind &&
      this.issuer.equals(other.issuer) &&
      this.audience.equals(other.audience) &&
      this.subject.equals(other.subject) &&
      this.claimed.size === other.claimed.size &&
      [...this.claimed].every(
        ([name, pattern]) => other.claimed.get(name)?.equals(pattern) ?? false,
      )
    );
  }
}
