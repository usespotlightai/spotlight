import type { InviteOfferDto } from '@identity/application/dto/invite.dto';
import type { InviteReaderPort } from '@identity/application/ports/invite-reader.port';
import type { ReadInviteQuery } from '@identity/application/queries/read-invite.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class ReadInviteHandler
  implements QueryHandlerPort<ReadInviteQuery, InviteOfferDto | null>
{
  constructor(
    private readonly invites: InviteReaderPort,
    private readonly tokens: TokenMintPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ReadInviteQuery): Promise<InviteOfferDto | null> {
    try {
      return await this.invites.withToken(
        TokenHash.of(this.tokens.hash(query.token)),
        this.clock.now(),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
