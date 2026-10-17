import type { WorkspaceTokenResourceResponseDto } from '@/lib/api';
import { settingsPath } from '@/lib/settings';

export type WorkspaceToken = WorkspaceTokenResourceResponseDto;

export type TokenScope = WorkspaceToken['scopes'][number];

export type TokenReach = Extract<TokenScope, 'read' | 'plan' | 'configure'>;

export type TokenGrant = Exclude<TokenScope, TokenReach>;

export type TokenTerms = {
  readonly name: string;
  readonly description: string;
  readonly scopes: TokenScope[];
  readonly expiresAt: string | null;
};

type ScopeOption<T extends TokenScope> = {
  readonly id: T;
  readonly label: string;
  readonly description: string;
};

export const REACHES: readonly ScopeOption<TokenReach>[] = [
  {
    id: 'read',
    label: 'Read',
    description: 'Reads the workspace’s configuration.',
  },
  {
    id: 'plan',
    label: 'Plan',
    description: 'Reads and checks expressions.',
  },
  {
    id: 'configure',
    label: 'Configure',
    description: 'Also changes configuration, like a Terraform apply.',
  },
];

export const GRANTS: readonly ScopeOption<TokenGrant>[] = [
  { id: 'secrets', label: 'Secrets', description: 'Also manages secrets.' },
  {
    id: 'runners',
    label: 'Runners',
    description: 'Also manages runner pools and runner trusts.',
  },
  {
    id: 'trusts',
    label: 'Token trusts',
    description: 'Also manages workspace token trusts.',
  },
];

const SCOPES: readonly ScopeOption<TokenScope>[] = [...REACHES, ...GRANTS];

export const scopesOf = (
  reach: TokenReach,
  grants: ReadonlySet<TokenGrant>,
): TokenScope[] => [
  reach,
  ...GRANTS.filter((each) => grants.has(each.id)).map((each) => each.id),
];

export const describeScopes = (scopes: readonly TokenScope[]): string => {
  const granted = new Set(scopes);

  return SCOPES.filter((each) => granted.has(each.id))
    .map((each) => each.label)
    .join(', ');
};

export const LIFETIMES = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
] as const;

export const USUAL_LIFETIME = '90';

const DAY = 24 * 60 * 60 * 1000;

export const expiryAfter = (
  days: string | null,
  now = Date.now(),
): string | null =>
  days === null ? null : new Date(now + Number(days) * DAY).toISOString();

const dayOf = (at: Date, now: number): string =>
  at.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(at.getFullYear() === new Date(now).getFullYear()
      ? {}
      : { year: 'numeric' as const }),
  });

export const describeCreated = (issuedAt: string, now = Date.now()): string =>
  `Created ${dayOf(new Date(issuedAt), now)}`;

export const describeExpiry = (
  expiresAt: string | null,
  now = Date.now(),
): string => {
  if (expiresAt === null) {
    return 'No expiry';
  }

  const expires = new Date(expiresAt);

  return expires.getTime() <= now
    ? 'Expired'
    : `Expires ${dayOf(expires, now)}`;
};

export const tokensPath = (slug: string) => `${settingsPath(slug)}/tokens`;
