import type { OidcTrustSummaryResponseDto } from '@/lib/api';
import { formatDate } from '@/lib/date-format';
import { nonEmpty } from '@/lib/non-empty';
import { since } from '@/lib/since';
import type { TooltipNote } from '@/lib/tooltip-note';

export type OidcTrust = OidcTrustSummaryResponseDto;

export const describeIssued = (lastIssuedAt: string | null): string =>
  nonEmpty(lastIssuedAt)
    ? `Issued ${since(lastIssuedAt)}`
    : 'Never issued a token';

const exactly = (at: string): string =>
  formatDate(new Date(at), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const minutes = (count: number): string =>
  count === 1 ? '1 minute' : `${count} minutes`;

export const trustNote = (trust: OidcTrust): TooltipNote => ({
  title: nonEmpty(trust.createdBy.name)
    ? `Created by ${trust.createdBy.name}`
    : 'Created by a deleted account',
  body: nonEmpty(trust.createdBy.name)
    ? 'Its tokens act for this person.'
    : 'Its tokens act for that account.',
  rows: [
    ['Created', exactly(trust.createdAt)],
    ...(nonEmpty(trust.lastIssuedAt)
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
