import type { OidcTrustSummaryResponseDto } from '@/lib/api';
import { since } from '@/lib/since';
import type { TooltipNote } from '@/lib/tooltip-note';

export type OidcTrust = OidcTrustSummaryResponseDto;

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
