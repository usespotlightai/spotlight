import type { UserEmailDto } from '@identity/application/dto/user-email.dto';
import type { UserEmailSummary } from '@identity/application/ports/user-email-reader.port';
import { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';

export const userEmailDtoOf = (summary: UserEmailSummary): UserEmailDto => ({
  id: summary.id,
  email: summary.email,
  status: summary.status,
  addedAt: summary.addedAt.toISOString(),
  sentAt: summary.sentAt.toISOString(),
});

export const userEmailDtoFrom = (email: UserEmail, now: Date): UserEmailDto =>
  userEmailDtoOf({
    id: email.id.value,
    email: email.email.value,
    status: email.statusAt(now),
    addedAt: email.addedAt,
    sentAt: email.sentAt,
  });
