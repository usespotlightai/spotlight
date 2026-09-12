import type { InviteOfferDto } from '@application/dto/invite.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { InviteReaderPort } from '@application/ports/invite-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { TokenMintPort } from '@application/ports/token-mint.port';
import type { ReadInviteQuery } from '@application/queries/read-invite.query';
import { TokenHash } from '@domain/value-objects/token-hash.vo';

export class ReadInviteHandler
  implements QueryHandlerPort<ReadInviteQuery, InviteOfferDto | null>
{
  constructor(
    private readonly invites: InviteReaderPort,
    private readonly tokens: TokenMintPort,
  ) {}

  async execute(query: ReadInviteQuery): Promise<InviteOfferDto | null> {
    try {
      return await this.invites.withToken(
        TokenHash.of(this.tokens.hash(query.token)),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
