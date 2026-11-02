import type { UserEmailResponseDto } from '@/lib/api';
import { daysAgo, hoursAgo } from '@/mocks/clock';
import { perWorld } from '@/mocks/world';

export const SIGN_IN_EMAIL = 'sam@example.com';

export const userEmail = (
  email: string,
  over: Partial<UserEmailResponseDto> = {},
): UserEmailResponseDto => ({
  id: `email_${email}`,
  email,
  status: 'pending',
  addedAt: hoursAgo(1),
  sentAt: hoursAgo(1),
  ...over,
});

const EMAILS: UserEmailResponseDto[] = [
  userEmail('sam.rivera@acme-corp.example', {
    status: 'verified',
    addedAt: daysAgo(30),
    sentAt: daysAgo(30),
  }),
  userEmail('sam@contractor.example', {
    status: 'expired',
    addedAt: daysAgo(3),
    sentAt: daysAgo(3),
  }),
];

export type EmailsWorld = {
  additional: UserEmailResponseDto[];
};

export const emailsWorld = perWorld(
  (kind): EmailsWorld => ({
    additional: kind === 'empty' ? [] : structuredClone(EMAILS),
  }),
);
