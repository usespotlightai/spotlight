import type { UserEmailsDto } from '@identity/application/dto/user-email.dto';
import { userEmailDtoOf } from '@identity/application/mappers/user-email.mapper';
import type { UserEmailReaderPort } from '@identity/application/ports/user-email-reader.port';
import type { ListUserEmailsQuery } from '@identity/application/queries/list-user-emails.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListUserEmailsHandler implements QueryHandlerPort<
  ListUserEmailsQuery,
  UserEmailsDto
> {
  constructor(
    private readonly emails: UserEmailReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListUserEmailsQuery): Promise<UserEmailsDto> {
    try {
      const additional = await this.emails.ofUser(
        UserId.of(query.viewerId),
        this.clock.now(),
      );

      return {
        signInEmail: query.viewerEmail,
        additional: additional.map(userEmailDtoOf),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
