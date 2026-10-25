import type { OidcTrustSummaryResponseDto } from '@/lib/api';
import { since } from '@/lib/since';
import { describeScopes } from '@/lib/token';
import type { TooltipNote } from '@/lib/tooltip-note';

export type OidcTrust = OidcTrustSummaryResponseDto;

export const GITHUB_ACTIONS_ISSUER =
  'https://token.actions.githubusercontent.com';

const GITHUB_SUBJECTS: readonly [
  RegExp,
  (repository: string, rest: string) => string,
][] = [
  [
    /^ref:refs\/heads\/([^:]+)$/,
    (repository, branch) => `${repository}, branch ${branch}`,
  ],
  [
    /^ref:refs\/tags\/([^:]+)$/,
    (repository, tag) => `${repository}, tag ${tag}`,
  ],
  [
    /^environment:([^:]+)$/,
    (repository, environment) => `${repository}, environment ${environment}`,
  ],
  [/^pull_request$/, (repository) => `${repository}, pull requests`],
];

const githubAdmitted = (subject: string): string => {
  const repository = subject.match(/^repo:([^/:*]+\/[^/:*]+):(.+)$/);

  if (repository && !subject.includes('*')) {
    const [, name, rest] = repository;

    for (const [pattern, describe] of GITHUB_SUBJECTS) {
      const matched = rest.match(pattern);
      if (matched) {
        return `GitHub Actions in ${describe(name, matched[1] ?? '')}`;
      }
    }
  }

  return `GitHub Actions: ${subject}`;
};

const hostOf = (issuer: string): string => {
  try {
    return new URL(issuer).host || issuer;
  } catch {
    return issuer;
  }
};

export const admitted = (trust: Pick<OidcTrust, 'issuer' | 'subject'>) =>
  trust.issuer === GITHUB_ACTIONS_ISSUER
    ? githubAdmitted(trust.subject)
    : `${hostOf(trust.issuer)}: ${trust.subject}`;

export const describeTrust = (trust: OidcTrust): string =>
  [admitted(trust), describeScopes(trust.scopes)].filter(Boolean).join(' · ');

export const describeIssued = (lastIssuedAt: string | null): string =>
  lastIssuedAt ? `Issued ${since(lastIssuedAt)}` : 'Never issued a token';

const exactly = (at: string): string =>
  new Date(at).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const minutes = (count: number): string =>
  count === 1 ? '1 minute' : `${count} minutes`;

export const trustNote = (trust: OidcTrust): TooltipNote => ({
  title: trust.createdBy.name
    ? `Created by ${trust.createdBy.name}`
    : 'Created by a deleted account',
  body: trust.createdBy.name
    ? 'Its tokens act for this person.'
    : 'Its tokens act for that account.',
  rows: [
    ['Created', exactly(trust.createdAt)],
    ...(trust.lastIssuedAt
      ? [['Last issued', exactly(trust.lastIssuedAt)] as const]
      : []),
    ['Issuer', trust.issuer],
    ['Subject', trust.subject],
    ...Object.entries(trust.claims).map(
      ([name, value]) => [`Claim ${name}`, value] as const,
    ),
    ['Token lifetime', minutes(trust.lifetimeMinutes)],
  ],
});
