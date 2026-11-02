import type { UserEmailResponseDto, UserEmailsResponseDto } from '@/lib/api';
import { settingsPath } from '@/lib/settings';

export type UserEmail = UserEmailResponseDto;

export type UserEmails = UserEmailsResponseDto;

export type UserEmailStatus = UserEmail['status'];

export const emailsPath = (slug: string): string =>
  `${settingsPath(slug)}/account/emails`;

export const verifyEmailPath = (token: string): string =>
  `/verify-email/${token}`;

export const statusOfEmail: Record<UserEmailStatus, string> = {
  verified: 'Verified',
  pending: 'Not verified',
  expired: 'Not verified',
};

export const describeEmail: Record<UserEmailStatus, string> = {
  verified: 'Spotlight knows you by this address',
  pending: 'Verification link sent. It works for 24 hours.',
  expired: 'Verification link expired. Please resend it.',
};
