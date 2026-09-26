import type { HookIssuerDto } from '@integrations/application/dto/hook-issuer.dto';
import type { HookTokensPort } from '@integrations/application/ports/hook-tokens.port';
import type { HookIssuerQuery } from '@integrations/application/queries/hook-issuer.query';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class HookIssuerHandler
  implements QueryHandlerPort<HookIssuerQuery, HookIssuerDto>
{
  constructor(private readonly tokens: HookTokensPort) {}

  async execute(): Promise<HookIssuerDto> {
    return { issuer: this.tokens.issuer, keys: await this.tokens.keys() };
  }
}
