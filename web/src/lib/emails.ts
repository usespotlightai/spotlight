import type { UserEmailResponseDto } from '@/lib/api';
import { settingsPath } from '@/lib/settings';

export type UserEmail = UserEmailResponseDto;

export type UserEmailStatus = UserEmail['status'];

export const emailsPath = (slug: string): string =>
  `${settingsPath(slug)}/account/emails`;

export const verifyEmailPath = (token: string): string =>
  `/verify-email/${token}`;

export const statusOfEmail: Record<UserEmailStatus, string> = {
  verified: 'Verified',
  pending: 'Verification link sent',
  expired: 'Verification link expired',
};
