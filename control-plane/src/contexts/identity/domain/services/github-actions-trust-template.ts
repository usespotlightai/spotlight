import type {
  OidcTrust,
  OidcTrustSpec,
} from '@identity/domain/aggregates/oidc-trust.aggregate';
import { TrustKeyTakenError } from '@identity/domain/exceptions/trust-key-taken.error';
import { UnsafeBranchNameError } from '@identity/domain/exceptions/unsafe-branch-name.error';
import { UnsupportedSubjectPrefixError } from '@identity/domain/exceptions/unsupported-subject-prefix.error';
import { OidcTrustDescription } from '@identity/domain/value-objects/oidc-trust-description.vo';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';

const GITHUB_ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com';

const PULL_REQUESTS_TRUST_KEY = 'github-pull-requests';

const DEFAULT_BRANCH_TRUST_KEY = 'github-apply';

const SUBJECT_PREFIX = String.raw`repo:[\w.-]+(?:@\d+)?/[\w.-]+(?:@\d+)?`;

const SUPPORTED_PREFIX = new RegExp(`^${SUBJECT_PREFIX}$`);

const SETUP_SUBJECTS: Readonly<Record<string, RegExp>> = {
  [PULL_REQUESTS_TRUST_KEY]: new RegExp(`^${SUBJECT_PREFIX}:pull_request$`),
  [DEFAULT_BRANCH_TRUST_KEY]: new RegExp(
    `^${SUBJECT_PREFIX}:ref:refs/heads/[^:*]+$`,
  ),
};

const PINNED_CLAIMS = ['repository_id', 'repository_owner_id'];

export interface GitHubRepositoryWorkloads {
  readonly subjectPrefix: string;
  readonly repositoryId: string;
  readonly ownerId: string;
  readonly defaultBranch: string;
  readonly applyScopes: readonly string[];
}

export interface GitHubActionsTrustSpecs {
  readonly pullRequests: OidcTrustSpec;
  readonly defaultBranch: OidcTrustSpec;
}

const specOf = (
  key: string,
  subject: string,
  claims: Readonly<Record<string, string>>,
  scopes: readonly string[],
  minutes: number,
): OidcTrustSpec => ({
  key: OidcTrustKey.of(key),
  workload: WorkloadRule.of({
    issuer: GITHUB_ACTIONS_ISSUER,
    audience: 'spotlight',
    subject,
    claims,
  }),
  scopes: TokenScopes.named(scopes),
  lifetime: TokenLifetime.ofMinutes(minutes),
  description: OidcTrustDescription.of(''),
});

const madeByTemplate = (trust: OidcTrust): boolean =>
  trust.workload.issuer.issued(GITHUB_ACTIONS_ISSUER) &&
  Object.keys(trust.workload.claims).every((claim) =>
    PINNED_CLAIMS.includes(claim),
  ) &&
  (SETUP_SUBJECTS[trust.key.value]?.test(trust.workload.subject.value) ??
    false);

export const GitHubActionsTrustTemplate = {
  specsFor(repository: GitHubRepositoryWorkloads): GitHubActionsTrustSpecs {
    if (/[*:]/.test(repository.defaultBranch)) {
      throw new UnsafeBranchNameError(repository.defaultBranch);
    }

    if (!SUPPORTED_PREFIX.test(repository.subjectPrefix)) {
      throw new UnsupportedSubjectPrefixError(repository.subjectPrefix);
    }

    const claims = {
      repository_id: repository.repositoryId,
      repository_owner_id: repository.ownerId,
    };

    return {
      pullRequests: specOf(
        PULL_REQUESTS_TRUST_KEY,
        `${repository.subjectPrefix}:pull_request`,
        claims,
        ['plan'],
        TokenLifetime.USUAL_MINUTES,
      ),
      defaultBranch: specOf(
        DEFAULT_BRANCH_TRUST_KEY,
        `${repository.subjectPrefix}:ref:refs/heads/${repository.defaultBranch}`,
        claims,
        repository.applyScopes,
        TokenLifetime.LONGEST_MINUTES,
      ),
    };
  },

  adopted(existing: OidcTrust, spec: OidcTrustSpec): OidcTrustSpec | null {
    if (!madeByTemplate(existing)) {
      throw new TrustKeyTakenError(
        existing.key.value,
        existing.workload.subject.value,
      );
    }

    return spec.workload.equals(existing.workload)
      ? null
      : {
          ...spec,
          scopes: existing.scopes,
          lifetime: existing.lifetime,
          description: existing.description,
        };
  },
};
