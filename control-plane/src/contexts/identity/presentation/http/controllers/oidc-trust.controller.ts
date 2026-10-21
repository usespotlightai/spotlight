import type { OidcTrustSummaryDto } from '@identity/application/dto/oidc-trust-summary.dto';
import { ListOidcTrustsQuery } from '@identity/application/queries/list-oidc-trusts.query';
import { OidcTrustSummaryResponseDto } from '@identity/presentation/http/dto/oidc-trust-summary.response.dto';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

@ApiTags('workspaces')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces')
export class OidcTrustController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':slug/oidc-trusts')
  @ApiOperation({
    operationId: 'listWorkspaceOidcTrusts',
    summary:
      'The workspace’s OIDC trusts, with who created each and when it last issued a token; only its admins may see. Terraform and the resource API write them',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiOkResponse({ type: OidcTrustSummaryResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace that you administer' })
  async list(
    @Param('slug') slug: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<OidcTrustSummaryResponseDto[]> {
    const trusts = await this.queryBus.execute<
      ListOidcTrustsQuery,
      readonly OidcTrustSummaryDto[] | null
    >(new ListOidcTrustsQuery(slug, principal));

    if (!trusts) {
      throw new NotFoundException();
    }

    return trusts.map((each) => new OidcTrustSummaryResponseDto(each));
  }
}
