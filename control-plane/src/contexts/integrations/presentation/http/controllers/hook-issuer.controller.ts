import type { HookIssuerDto } from '@integrations/application/dto/hook-issuer.dto';
import { HookIssuerQuery } from '@integrations/application/queries/hook-issuer.query';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';

@ApiTags('hooks')
@AllowAnonymous()
@Controller('.well-known')
export class HookIssuerController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('openid-configuration')
  @ApiOperation({
    operationId: 'hookIssuer',
    summary:
      'How an endpoint checks the OIDC tokens hooks sign their requests with',
  })
  @ApiOkResponse({ description: 'OpenID provider metadata, for tokens only' })
  async configuration(): Promise<Record<string, unknown>> {
    const { issuer } = await this.issuer();

    return {
      issuer,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      id_token_signing_alg_values_supported: ['ES256'],
      response_types_supported: ['id_token'],
      subject_types_supported: ['public'],
    };
  }

  @Get('jwks.json')
  @ApiOperation({
    operationId: 'hookSigningKeys',
    summary: 'The public keys hook tokens are signed with',
  })
  @ApiOkResponse({ description: 'A JSON Web Key Set' })
  async keys(): Promise<HookIssuerDto['keys']> {
    return (await this.issuer()).keys;
  }

  private issuer(): Promise<HookIssuerDto> {
    return this.queryBus.execute<HookIssuerQuery, HookIssuerDto>(
      new HookIssuerQuery(),
    );
  }
}
