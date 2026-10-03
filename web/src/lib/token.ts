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

type Told<T extends TokenScope> = {
  readonly id: T;
  readonly label: string;
  readonly told: string;
};

export const REACHES: readonly Told<TokenReach>[] = [
  {
    id: 'read',
    label: 'Read',
    told: 'Reads the workspace’s configuration.',
  },
  {
    id: 'plan',
    label: 'Plan',
    told: 'Reads, and checks expressions.',
  },
  {
    id: 'configure',
    label: 'Configure',
    told: 'Also changes configuration, as Terraform does when it applies.',
  },
];

export const GRANTS: readonly Told<TokenGrant>[] = [
  { id: 'secrets', label: 'Secrets', told: 'Also manages secrets.' },
  {
    id: 'runners',
    label: 'Runners',
    told: 'Also manages runner pools and runner trusts.',
  },
  {
    id: 'trusts',
    label: 'Token trusts',
    told: 'Also manages workspace token trusts.',
  },
];

const SCOPES: readonly Told<TokenScope>[] = [...REACHES, ...GRANTS];

export const scopesOf = (
  reach: TokenReach,
  grants: ReadonlySet<TokenGrant>,
): TokenScope[] => [
  reach,
  ...GRANTS.filter((each) => grants.has(each.id)).map((each) => each.id),
];

export const scopesTold = (scopes: readonly TokenScope[]): string =>
  SCOPES.filter((each) => scopes.includes(each.id))
    .map((each) => each.label)
    .join(', ');

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

export const expiryTold = (
  expiresAt: string | null,
  now = Date.now(),
): string => {
  if (expiresAt === null) {
    return 'Never expires';
  }

  const expires = new Date(expiresAt);

  if (expires.getTime() <= now) {
    return 'Expired';
  }

  return `Expires ${expires.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

export const tokensPath = (slug: string) => `${settingsPath(slug)}/tokens`;
