import type { ConfigurationChangeDto } from '@identity/application/dto/configuration-change.dto';
import { ListConfigurationChangesQuery } from '@identity/application/queries/list-configuration-changes.query';
import { ConfigurationChangeResponseDto } from '@identity/presentation/http/dto/configuration-change.response.dto';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const PAGE = 50;

const LONGEST_PAGE = 200;

@ApiTags('workspaces')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces')
export class ConfigurationChangeController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':slug/configuration-changes')
  @ApiOperation({
    operationId: 'listConfigurationChanges',
    summary:
      'Who changed the workspace’s configuration, what they changed and through which client, newest first; only its admins may see',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiQuery({
    name: 'before',
    required: false,
    type: Number,
    description: 'Only changes older than this seq',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `At most this many, up to ${LONGEST_PAGE}`,
  })
  @ApiOkResponse({ type: ConfigurationChangeResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace that you administer' })
  async list(
    @Param('slug') slug: string,
    @Query('before', new ParseIntPipe({ optional: true })) before:
      | number
      | undefined,
    @Query('limit', new ParseIntPipe({ optional: true })) limit:
      | number
      | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ConfigurationChangeResponseDto[]> {
    const changes = await this.queryBus.execute<
      ListConfigurationChangesQuery,
      readonly ConfigurationChangeDto[] | null
    >(
      new ListConfigurationChangesQuery(slug, principal, {
        before: before ?? null,
        limit: Math.min(Math.max(limit ?? PAGE, 1), LONGEST_PAGE),
      }),
    );

    if (!changes) {
      throw new NotFoundException();
    }

    return changes.map((each) => new ConfigurationChangeResponseDto(each));
  }
}
